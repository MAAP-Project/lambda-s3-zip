// Lambda S3 Zipper
// http://amiantos.net/zip-multiple-files-on-aws-s3/
//
// Accepts a bundle of data in the format...
// {
//     "bucket": "your-bucket",
//     "destination_key": "zips/test.zip",
//     "files": [
//         {
//             "uri": "...", (options: S3 file key or URL)
//             "filename": "...", (filename of file inside zip)
//             "type": "..." (options: [file, url])
//         }
//     ]
// }
// Saves zip file at "destination_key" location

"use strict";

const AWS = require("aws-sdk");
const awsOptions = {
  region: "us-east-1",
  httpOptions: {
    timeout: 900000 // Matching Lambda function timeout
  }
};
const s3 = new AWS.S3(awsOptions);
const archiver = require("archiver");
const stream = require("stream");
const request = require("request");

const streamTo = (bucket, key, resolve) => {
  var passthrough = new stream.PassThrough();
  s3.upload(
    {
      Bucket: bucket,
      Key: key,
      Body: passthrough,
      ContentType: "application/zip",
      ServerSideEncryption: "AES256"
    },
    (err, data) => {
      if (err) throw err;
      console.log("Zip uploaded");
      resolve();
    }
  ).on("httpUploadProgress", (progress) => {
    console.log(progress);
  });
  return passthrough;
};

// Kudos to this person on GitHub for this getStream solution
// https://github.com/aws/aws-sdk-js/issues/2087#issuecomment-474722151
const getStream = (bucket, key) => {
  let streamCreated = false;
  const passThroughStream = new stream.PassThrough();

  passThroughStream.on("newListener", event => {
    if (!streamCreated && event == "data") {
      const s3Stream = s3
        .getObject({ Bucket: bucket, Key: key })
        .createReadStream();
      s3Stream
        .on("error", err => passThroughStream.emit("error", err))
        .pipe(passThroughStream);

      streamCreated = true;
    }
  });

  return passThroughStream;
};

exports.handler = async (event, context, callback) => {
  var bucket = event["bucket"];
  var source_bucket = event["source_bucket"];
  var destinationKey = event["destination_key"];
  var files = event["files"];

  await new Promise(async (resolve, reject) => {
    var zipStream = streamTo(bucket, destinationKey, resolve);
    zipStream.on("error", reject);

    var archive = archiver("zip");
    archive.on("error", err => {
      throw new Error(err);
    });
    archive.pipe(zipStream);

    for (const file of files) {
      if (file["type"] == "file") {
        archive.append(getStream(source_bucket, file["uri"]), {
          name: file["filename"]
        });
      } else if (file["type"] == "url") {
        archive.append(request(file["uri"]), { name: file["filename"] });
      }
    }
    archive.finalize();
  }).catch(err => {
    throw new Error(err);
  });

  callback(null, {
    statusCode: 200,
    body: { final_destination: destinationKey }
  });
};

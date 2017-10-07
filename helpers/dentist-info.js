const S3Client = require('aws-sdk/clients/s3');

const S3 = new S3Client({
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_ACCESS_KEY
});

const params = {
  Bucket: 'dentalman_uploads',
};

function deleteObject(parameters) {
  return new Promise((resolve, reject) => {
    S3.deleteObject(parameters, (err, data) => {
      if (err) {
        return reject(err);
      }
      return resolve(data);
    });
  });
}

async function deleteObjectInS3(imageUrl) {
  try {
    const Key = imageUrl.split('amazonaws.com/')[1];
    await deleteObject({ ...params, Key });
    return true;
  } catch (e) {
    console.log(e);
    throw e;
  }
}

export {
  deleteObjectInS3
};

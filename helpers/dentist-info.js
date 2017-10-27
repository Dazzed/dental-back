import S3 from './S3Client';

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

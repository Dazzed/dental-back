import S3 from './S3Client';

const params = {
  Bucket: 'market_materials',
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

async function deleteObjectInS3(url) {
  try {
    const Key = url.split('amazonaws.com/')[1];
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

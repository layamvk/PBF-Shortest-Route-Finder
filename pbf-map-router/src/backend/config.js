const path = require('path');

module.exports = {
  PORT: 3000,
  UPLOAD_DIR: path.join(__dirname, '../../uploads/'),
  MAX_FILE_SIZE: Infinity
};
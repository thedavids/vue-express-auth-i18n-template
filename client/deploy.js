import dotenv from 'dotenv';
import FTPDeploy from 'ftp-deploy';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: '.env.deploy' });

const ftpDeploy = new FTPDeploy();

const ftpConfig = {
  user: process.env.FTP_USER,
  password: process.env.FTP_PASS,
  host: process.env.FTP_HOST,
  port: 21,
  localRoot: './dist',
  remoteRoot: process.env.FTP_REMOTE_DIR,
  include: ['*', '**/*'],
  deleteRemote: false
};

console.log('📁 Files in ./dist:', fs.readdirSync('./dist'));

ftpDeploy
  .deploy(ftpConfig)
  .then(() => console.log('✅ Deployed!'))
  .catch(err => console.error('❌ FTP Deploy Error:', err));
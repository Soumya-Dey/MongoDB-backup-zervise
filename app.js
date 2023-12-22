const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

/* 
Basic mongo dump and restore commands, they contain more options you can have a look at man page for both of them.
1. mongodump --db=service-desk --archive=./service-desk.gzip --gzip
2. mongorestore --db=service-desk --archive=./service-desk.gzip --gzip
*/

const DB_NAME = 'service-desk';
const RCLONE_REMOTE = 'zervise';
const RCLONE_DEST = 'ZerviseBackUp';

// syncs the files in backup directory with google drive folder using rclone
const sync = (rcloneRemote = RCLONE_REMOTE, rcloneDest = RCLONE_DEST) => {
  console.log('\nStarting sync with google drive...\n');

  const child = spawn('rclone', [
    'sync',
    path.join(__dirname, 'backup'),
    `${rcloneRemote}:${rcloneDest}`,
    '-v',
  ]);

  child.stdout.on('data', (data) => {
    console.log('output:\n', data);
  });
  child.stderr.on('data', (data) => {
    console.log('output:\n', Buffer.from(data).toString());
  });
  child.on('error', (error) => {
    console.log('error:\n', error);
  });
  child.on('exit', (code, signal) => {
    if (code) console.log('Process exit with code:', code);
    else if (signal) console.log('Process killed with signal:', signal);
    else {
      console.log('Sync with google drive is successfull. ✅');
    }
  });
};

// copies the pm2 log files and calls the next function to sync files with google drive
const copyLogs = (rcloneRemote = RCLONE_REMOTE, rcloneDest = RCLONE_DEST) => {
  console.log('\nStarting pm2 log file copy...\n');

  const LOG_PATH = path.join(__dirname, 'backup', `pm2-logs/`);
  if (!fs.existsSync(LOG_PATH)) fs.mkdirSync(LOG_PATH, { recursive: true });

  const child = spawn('cp', ['/root/.pm2/logs/service-desk*.log', LOG_PATH]);

  child.stdout.on('data', (data) => {
    console.log('output:\n', data);
  });
  child.stderr.on('data', (data) => {
    console.log('output:\n', Buffer.from(data).toString());
  });
  child.on('error', (error) => {
    console.log('error:\n', error);
  });
  child.on('exit', (code, signal) => {
    if (code) console.log('Process exit with code:', code);
    else if (signal) console.log('Process killed with signal:', signal);
    else {
      console.log('Pm2 log file copy is successfull. ✅');

      sync(rcloneRemote, rcloneDest);
    }
  });
};

// creates db backup gzip file and calls the next function to copy pm2 log files
const backup = (
  db = DB_NAME,
  rcloneRemote = RCLONE_REMOTE,
  rcloneDest = RCLONE_DEST
) => {
  console.log('\nStarting mongodb backup...\n');

  // const today = new Date(new Date().getTime() + 19800000);
  const FOLDER_PATH = path.join(
    __dirname,
    'backup'
    // `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`
  );
  const ARCHIVE_PATH = path.join(FOLDER_PATH, `${DB_NAME}.gzip`);
  if (!fs.existsSync(FOLDER_PATH))
    fs.mkdirSync(FOLDER_PATH, { recursive: true });

  const child = spawn('mongodump', [
    `--db=${db}`,
    `--excludeCollection=dblogs`,
    `--archive=${ARCHIVE_PATH}`,
    '--gzip',
  ]);

  child.stdout.on('data', (data) => {
    console.log('stdout:\n', data);
  });
  child.stderr.on('data', (data) => {
    console.log('stderr:\n', Buffer.from(data).toString());
  });
  child.on('error', (error) => {
    console.log('error:\n', error);
  });
  child.on('exit', (code, signal) => {
    if (code) console.log('Process exit with code:', code);
    else if (signal) console.log('Process killed with signal:', signal);
    else {
      console.log('MongoDB backup is successfull. ✅');

      copyLogs(rcloneRemote, rcloneDest);
    }
  });
};

// 1. Cron expression for every 5 seconds - */5 * * * * *
// 2. Cron expression for every night at 04:30 UTC or 10:00 IST hours - 30 4 * * *
// Scheduling the backup every day at 00:00
cron.schedule('30 4 * * *', () => backup(DB_NAME, RCLONE_REMOTE, RCLONE_DEST));
// backup(DB_NAME, RCLONE_REMOTE, RCLONE_DEST);

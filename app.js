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

const backupAndSync = (
  db = 'service-desk',
  rcloneRemote = 'drive',
  rcloneDest = 'service-desk'
) => {
  console.log('\nStarting mongodb backup...\n');

  const today = new Date(new Date().getTime() + 19800000);
  const FOLDER_PATH = path.join(
    __dirname,
    'backup',
    `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`
  );
  const ARCHIVE_PATH = path.join(
    FOLDER_PATH,
    `${DB_NAME}_${today.getDate()}-${
      today.getMonth() + 1
    }-${today.getFullYear()}_${today.getHours()}-${today.getMinutes()}-${today.getSeconds()}.gzip`
  );
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

      console.log('\nStarting sync with google drive...\n');

      const child2 = spawn('rclone', [
        'sync',
        path.join(__dirname, 'backup'),
        `${rcloneRemote}:${rcloneDest}`,
        '-v',
      ]);

      child2.stdout.on('data', (data) => {
        console.log('output:\n', data);
      });
      child2.stderr.on('data', (data) => {
        console.log('output:\n', Buffer.from(data).toString());
      });
      child2.on('error', (error) => {
        console.log('error:\n', error);
      });
      child2.on('exit', (code, signal) => {
        if (code) console.log('Process exit with code:', code);
        else if (signal) console.log('Process killed with signal:', signal);
        else {
          console.log('Sync with google drive is successfull. ✅');
        }
      });
    }
  });
};

// 1. Cron expression for every 5 seconds - */5 * * * * *
// 2. Cron expression for every night at 04:30 UTC or 10:00 IST hours (30 4 * * * )
// Scheduling the backup every day at 00:00
cron.schedule('0 0 * * *', () =>
  backupAndSync(DB_NAME, RCLONE_REMOTE, 'ZerviseBackUp')
);
// backupAndSync(DB_NAME, RCLONE_REMOTE, 'ZerviseBackUp');

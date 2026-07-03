const http = require('http');
const options = {
    host: 'localhost',
    port: '4000',
    path: '/health',
    timeout: 2000
};
const request = http.request(options, (res) => {
    process.exitCode = (res.statusCode === 200) ? 0 : 1;
    process.exit();
});
request.on('error', (err) => {
    process.exitCode = 1;
    process.exit();
});
request.end();
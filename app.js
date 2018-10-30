let express = require('express');
let app = express();
let server = require('http').Server(app);
let io = require('socket.io')(server);

let cookieParser = require('cookie-parser');
let apiController = require('./controllers/apiController');
let authController = require('./authController/verifyLDAP');

let port = process.env.PORT || 8080;

app.use('/', express.static(__dirname + '/public'));
app.set('view engine', 'ejs');

app.use(cookieParser());
apiController(app);
authController(app);

//app.listen(port);
server.listen(port);
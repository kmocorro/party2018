let bodyParser = require('body-parser');
let uuidv4 = require('uuid/v4');
let jwt = require('jsonwebtoken');
let formidable = require('formidable');
let mysql = require('../config');
let moment = require('moment');
let fs = require('fs');
let config = require('../config').authSecret;
let verifyToken = require('../authController/verifyToken');

module.exports = function(app){

    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({extended: false}));

    /** First page */
    app.get('/', verifyToken, function(req, res){
        res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        res.header('Expires', '-1');
        res.header('Pragma', 'no-cache');

        if(req.userID && req.claim){

            let authenticity_token = jwt.sign({
                id: uuidv4(),
                claim: {
                    signup: 'valid'
                }
            }, config.secret);

            function party_list_credentials(){
                return new Promise(function(resolve, reject){

                    mysql.pool.getConnection(function(err, connection){
                        if(err){return reject(err)};

                        connection.query({
                            sql: 'SELECT * FROM app_party_list WHERE employeeNumber = ?',
                            values: [req.claim.employeeNumber]
                        },  function(err, results){
                            if(err){return reject(err)};
                            
                            let party_list_data = [];

                            if(typeof results[0] !== 'undefined' && results[0] !== null && results.length > 0){

                                party_list_data.push({
                                    employeeNumber: results[0].employeeNumber,
                                    lastname: results[0].lastname,
                                    firstname: results[0].firstname,
                                    midname: results[0].midname,
                                    supervisor: results[0].supervisor,
                                    title: results[0].title,
                                    shift: (results[0].shift).replace(/[\n\r]+/g, '')
                                });

                                resolve(party_list_data);

                            } else {

                                party_list_data.push({
                                    employeeNumber: "",
                                    lastname: "",
                                    firstname: "",
                                    midname: "",
                                    supervisor: "",
                                    title: "",
                                    shift: ""
                                });

                                resolve(party_list_data);
                            }
                            
                        });

                        connection.release();

                    });

                });

            }

            function party_confirmed_or_not(){
                return new Promise(function(resolve, reject){

                    mysql.pool.getConnection(function(err, connection){
                        if(err){return reject(err)};

                        connection.query({
                            sql: 'SELECT * FROM app_party WHERE employeeNumber = ? ',
                            values: [req.claim.employeeNumber]
                        },  function(err, results){
                            if(err){return reject(err)};

                            if(typeof results[0] !== 'undefined' && results[0] !== null && results.length > 0){
                                console.log(results[0]);
                                
                                if(results[0].incoming_shuttle == ''){
                                    let confirmation = 'Declined';

                                    resolve(confirmation);
                                } else { 

                                    let confirmation = 'Confirmed';

                                    resolve(confirmation);
                                }

                            } else {

                                let confirmation = 'Unconfirmed';

                                resolve(confirmation);

                            }

                        });

                        connection.release();
                        
                    });


                });
            }

            party_list_credentials().then(function(party_list_data){

                party_confirmed_or_not().then(function(confirmation){

                    let party_schedule = {
                        firstDay: 'December 5, 2018 - 5:00PM ',
                        secondDay: 'December 6, 2018 - 5:00PM'
                    }
    
                    let personal_sched = []
    
                    if(party_list_data[0].shift == 'X' || party_list_data[0].shift == 'Y'){
    
                        personal_sched.push({
                            day: party_schedule.firstDay
                        });
    
                    } else {
    
                        personal_sched.push({
                            day: party_schedule.secondDay
                        });
                    }
    
                    res.render('home', { authenticity_token, name: req.claim.displayName, department: req.claim.department, title: req.claim.title, employeeNumber: req.claim.employeeNumber, username: req.claim.username, givenName: req.claim.givenName, shift: party_list_data[0].shift , party_sched: personal_sched[0].day, supervisor: party_list_data[0].supervisor, confirmation: confirmation });


                },  function(err){
                    res.send({err: 'Error occured at confirmed or not. ' + err})
                });

            },  function(err){
                res.send({err: 'Error occured at party list credentials. ' + err});
            });

            

        } else {
            res.redirect('login');
        }

    });

    /** API for year-end party 2018 */
    app.post('/api/party', function(req, res){
        let form = new formidable.IncomingForm();

        form.parse(req, function(err, fields){
            if(err){ return res.send({err: 'Invalid form. Try again'})};

            if(fields){
                //console.log(fields);

                let user_data_party = {
                    credentials: fields.authenticity_token,
                    date_time: moment(new Date()).format(),
                    employeeNumber: fields.employeeNumber,
                    username: fields.username,
                    name: fields.name,
                    department: fields.department,
                    title: fields.title,
                    boolAttend: fields.boolAttend,
                    reason: fields.reason || "",
                    incoming_shuttle: fields.incoming_shuttle || "",
                    outgoing_shuttle: fields.outgoing_shuttle || ""
                }

                //  verify token
                function verifyLinkToken(){ // resolve()
                    return new Promise(function(resolve, reject){

                        jwt.verify(user_data_party.credentials, config.secret, function(err, decoded){
                            if(err){ return reject(err)};

                            resolve();

                        });

                    });
                }

                function surveyCheck_ifExist(){
                    return new Promise(function(resolve, reject){

                        mysql.pool.getConnection(function(err, connection){
                            if(err){return reject(err)};

                            connection.query({
                                sql: 'SELECT * FROM app_party WHERE employeeNumber = ?',
                                values: [user_data_party.employeeNumber]
                            },  function(err, results){
                                if(err){return reject(err)};

                                if(typeof results[0] !== 'undefined' && results[0] !== null && results.length > 0){
                                    reject(results[0].employeeNumber);
                                } else {
                                    resolve();
                                }

                            });

                            connection.release();

                        });


                    });
                }

                function surveyStore(){
                    return new Promise(function(resolve, reject){

                        mysql.pool.getConnection(function(err, connection){
                            if(err){return reject(err)};

                            connection.query({
                                sql: 'INSERT INTO app_party SET date_time = ?, employeeNumber = ?, username=?, name=?, department=?, title=?, boolAttend=?, reason=?, incoming_shuttle=?, outgoing_shuttle=?',
                                values: [user_data_party.date_time, user_data_party.employeeNumber, user_data_party.username, user_data_party.name, user_data_party.department, user_data_party.title, user_data_party.boolAttend, user_data_party.reason, user_data_party.incoming_shuttle, user_data_party.outgoing_shuttle]
                            },  function(err, results){
                                if(err){return reject(err)};

                                resolve(results);

                            });

                            connection.release();

                        });


                    });
                }

                if(user_data_party.employeeNumber && user_data_party.username && user_data_party.name && user_data_party.department && user_data_party.title && user_data_party.boolAttend){

                    verifyLinkToken().then(function(){
                        surveyCheck_ifExist().then(function(){
                            surveyStore().then(function(results){

                                res.send({auth: 'Successfully submitted. Thank you!'});
                            },  function(err){
                                res.send({err: 'Error while saving to database...' + err});
                            });

                        },  function(err){
                            res.send({err: 'Invalid entry. Employee number: ' + err + ' survey already exists.'});
                        });
                        
                    },  function(){
                        res.send({err: 'Invalid token. Please refresh page.'});
                    });

                } else {
                    res.send({err: 'Invalid form. Some hidden items are missing.'});
                }


            } else {
                res.send({err: 'Invalid form. Try again.'});
            }

        });


    });

    /** GET API for user LOGIN PAGE */
    app.get('/login', function(req, res){

        let authenticity_token = jwt.sign({
            id: uuidv4(),
            claim: {
                signup: 'valid'
            }
        }, config.secret, { expiresIn: 300 });

        res.render('login', {authenticity_token});
    });

    /** GET API for user LOGOUT PAGE */
    app.get('/logout', function(req, res){
        res.cookie('auth', null);
        res.redirect('/');
    });

}
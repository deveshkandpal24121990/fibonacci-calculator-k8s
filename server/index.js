const keys = require('./keys');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(bodyParser.json());

const {Pool} = require('pg');
const pgClient = new Pool({
    user : keys.pgUsername,
    host : keys.pgHost,
    database : keys.pgDatabase,
    password : keys.pgPassword,
    port : keys.pgPort
});

pgClient.on('error', () => console.log('Lost Connection to PG'));

pgClient
.query("CREATE TABLE IF NOT EXISTS values(number INT)")
.catch(err => console.log(err));

const redis = require('redis');
const redisClient = redis.createClient({
    host : keys.redisHost,
    port : keys.redisPort,
    retry_strategy : () => 1000
});

const redisPublisher = redisClient.duplicate();


app.get('/', (req, res) => {
    res.send('Hi');
});

app.get('/values/all', async (req, res) => {
    console.log("RECEIVED REQUEST FOR ALL");
const values =  await pgClient.query("SELECT * FROM values");

res.send(values.rows);
});

app.get('/values/current', async(req, res) => {
    console.log("RECEIVED REQUEST FOR CURRENT");
    redisClient.hgetall('values', (err, values) => {
        if(err) {
            console.log('ERROR WHILE DOING A CURRENT CALL');
            throw err;
        } else {
            console.log("CURRENT VALUES FOUND");
        }
        res.send(values);
    });
});

app.post('/values', async (req,res) => {
    const index = req.body.index;
    if(parseInt(index) > 40) {
        return res.status(422).send('Index too high');
    }

    redisClient.hset('values', index, 'Nothing yet!');  
    redisPublisher.publish('insert', index);
    pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);

    res.send({working : true});
});

app.listen(5000, err => {
    console.log('Listening on port 5000');
});
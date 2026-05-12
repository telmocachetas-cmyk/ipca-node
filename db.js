const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['1.1.1.1', '8.8.8.8']);
const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);
let db;

async function connectDB() {
    try {
        await client.connect();
        db = client.db(process.env.DB_NAME || 'ipca');
        console.log('✅ Conectado ao MongoDB Atlas');
        return db;
    } catch (error) {
        console.error('❌ Erro na conexão:', error);
        process.exit(1);
    }
}

function getDB() {
    if (!db) throw new Error('Base de dados não conectada');
    return db;
}

module.exports = { connectDB, getDB, client };
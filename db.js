const dns = require('dns');
const { MongoClient } = require('mongodb');
require('dotenv').config();

if (dns.getServers().length === 1 && dns.getServers()[0] === '127.0.0.1') {
    const dnsServer = process.env.MONGODB_DNS_SERVER;
    if (dnsServer) {
        dns.setServers([dnsServer]);
        console.log('🔧 Usando DNS personalizado para Node:', dnsServer);
    }
}

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
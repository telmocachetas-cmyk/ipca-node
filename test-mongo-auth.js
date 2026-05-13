const dns = require('dns');
const { MongoClient } = require('mongodb');

dns.setServers(['172.16.64.1']);

const uris = [
  'mongodb+srv://telmo:QTSXxtAiY5UrRc9E@cluster0.jb7hjaa.mongodb.net/ipca?retryWrites=true&w=majority',
  'mongodb+srv://telmo:QTSXxtAiY5UrRc9E@cluster0.jb7hjaa.mongodb.net/ipca?authSource=admin&retryWrites=true&w=majority',
  'mongodb+srv://telmo:QTSXxtAiY5UrRc9E@cluster0.jb7hjaa.mongodb.net/ipca?authSource=ipca&retryWrites=true&w=majority'
];

(async () => {
  for (const uri of uris) {
    const client = new MongoClient(uri);
    try {
      await client.connect();
      console.log('SUCCESS', uri);
      await client.close();
    } catch (err) {
      console.log('FAIL', uri, err.code, err.message);
    }
  }
})();

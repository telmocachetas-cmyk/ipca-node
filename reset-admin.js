const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://admin:lijo2007@cluster0.jb7hjaa.mongodb.net/";

async function resetAdmin() {
    const client = new MongoClient(uri);
    
    try {
        await client.connect();
        console.log("✅ Conectado ao MongoDB");
        
        const db = client.db('ipca');
        
        // Apagar admin antigo
        await db.collection('users').deleteOne({ login: "admin" });
        
        // COLOCAR A NOVA HASH AQUI (a que copiaste)
        const novaHash = "$2b$10$zuQHhVwYylTZOuOv6JjYq./TUkcl.sSaY8e2YMCJTprj1EIacobxq";
        
        // Criar novo admin
        await db.collection('users').insertOne({
            login: "admin",
            pwd: novaHash,
            grupo: "ADMIN",
            data_registo: new Date()
        });
        
        const admin = await db.collection('users').findOne({ login: "admin" });
        console.log("✅ Admin atualizado com sucesso!");
        console.log("Hash guardada:", admin.pwd);
        
    } catch (error) {
        console.error("Erro:", error);
    } finally {
        await client.close();
    }
}

resetAdmin();
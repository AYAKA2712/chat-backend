require("dotenv").config();
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/chatDB";
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log("Connected to MongoDB"))
.catch((err) => console.error("MongoDB Connection Error:", err));

// Define Chat Message Schema
const MessageSchema = new mongoose.Schema({
    username: String,
    message: String,
    timestamp: { type: Date, default: Date.now },
});

const Message = mongoose.model("Message", MessageSchema);

// WebSocket Connection Handling
wss.on("connection", (ws) => {
    console.log("New client connected");

    // Send past messages when a client connects
    Message.find().sort({ timestamp: 1 }).then((messages) => {
        ws.send(JSON.stringify({ type: "history", messages }));
    });

    ws.on("message", async (data) => {
        const parsedData = JSON.parse(data);
        if (parsedData.type === "chat") {
            const newMessage = new Message({
                username: parsedData.username,
                message: parsedData.message,
            });

            await newMessage.save();
            console.log("Message saved to DB:", newMessage);

            // Broadcast message to all clients
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: "chat",
                        username: newMessage.username,
                        message: newMessage.message,
                        timestamp: newMessage.timestamp
                    }));
                }
            });
        }
    });

    ws.on("close", () => console.log("Client disconnected"));
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

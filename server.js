const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 1. MongoDB Atlas 연결
const MONGO_URI = process.env.MONGODB_URI || "mongodb+srv://capstonedesign:capstonedesign_07@cluster0.rm17unn.mongodb.net/ble_tracker?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Atlas 연결 성공!'))
  .catch((err) => console.error('MongoDB Atlas 연결 실패:', err));

// 2. 웹소켓 클라이언트 관리 및 핑-퐁(Ping-Pong) 설정
const appClients = new Set();

const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      appClients.delete(ws);
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('connection', (ws) => {
  console.log('모바일 앱 웹소켓 연결 완료');
  ws.isAlive = true;
  appClients.add(ws);

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('close', () => {
    appClients.delete(ws);
  });
});

wss.on('close', () => {
  clearInterval(interval);
});

// 3. DB 스키마 정의
const LocationSchema = new mongoose.Schema({
  deviceId: String,
  latitude: Number,
  longitude: Number,
  rssi: Number,
  timestamp: { type: Date, default: Date.now }
});

const Location = mongoose.model('Location', LocationSchema);

// 4. API 엔드포인트
// (1) 데이터 수신 및 실시간 브로드캐스트
app.post('/api/ble/relay', async (req, res) => {
  try {
    const { deviceId, latitude, longitude, rssi } = req.body;

    const locationData = new Location({ deviceId, latitude, longitude, rssi });
    await locationData.save();

    const payload = JSON.stringify({
      event: 'LOCATION_UPDATE',
      data: locationData
    });

    appClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });

    return res.status(200).json({ status: 'success', data: locationData });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

// (2) 과거 위치 이력 조회 API
app.get('/api/ble/history/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const history = await Location.find({ deviceId })
      .sort({ timestamp: -1 })
      .limit(limit);

    return res.status(200).json({ status: 'success', count: history.length, data: history });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

// 5. 서버 실행
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

app.get('/', (req, res) => {
  res.send('Capstonedesign BLE Tracking Server is Running!');
});
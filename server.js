const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(cors());
app.use(express.json());

// 1. MongoDB Atlas 클라우드 DB 연결
// (본인의 MongoDB Connection String 주소로 교체)
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://capstonedesign:capstonedesign_07@capstonedesign.rm17unn.mongodb.net/?appName=Capstonedesign";

mongoose.connect(MONGO_URI)
  .then(() => console.log('[DB] MongoDB Atlas 클라우드 연결 성공'))
  .catch(err => console.error('[DB] 연결 에러:', err));

// 2. 위치 데이터 스키마(규격) 정의
const LocationSchema = new mongoose.Schema({
  deviceId: { type: String, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  rssi: { type: Number, default: 0 },
  battery: { type: Number, default: 100 },
  timestamp: { type: Date, default: Date.now }
});

const Location = mongoose.model('Location', LocationSchema);

// 3. API 엔드포인트 정의

// [POST] 스마트폰이 BLE로 수집한 위치 데이터를 클라우드 DB에 저장
app.post('/api/ble/relay', async (req, res) => {
  try {
    const { deviceId, latitude, longitude, rssi, battery } = req.body;

    if (!deviceId || !latitude || !longitude) {
      return res.status(400).json({ status: "error", message: "필수 데이터 누락" });
    }

    const newLocation = new Location({
      deviceId,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      rssi: parseInt(rssi) || 0,
      battery: parseInt(battery) || 100
    });

    await newLocation.save();
    console.log(`[수신 완료] ${deviceId} | 위도: ${latitude}, 경도: ${longitude}`);
    
    res.status(201).json({ status: "success", message: "클라우드 저장 성공" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// [GET] 특정 기기의 최신 위치 조회 (앱/웹 대시보드 표시용)
app.get('/api/location/latest/:deviceId', async (req, res) => {
  try {
    const latest = await Location.findOne({ deviceId: req.params.deviceId })
                                  .sort({ timestamp: -1 });
    if (!latest) return res.status(404).json({ message: "기기 데이터 없음" });
    res.json(latest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 서버 가동
app.listen(PORT, () => {
  console.log(`[클라우드 서버 가동 중] 포트: ${PORT}`);
});
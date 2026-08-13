import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  StatusBar
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ============================================================================
// GEMINI API KONFİGÜRASYONU
// ============================================================================
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY_HERE';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export default function App() {
  const [currentMode, setCurrentMode] = useState('calculator');
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [calcMode, setCalcMode] = useState('Temel');

  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState(null);
  const [photoBase64, setPhotoBase64] = useState(null);
  const [loading, setLoading] = useState(false);
  const [solutionData, setSolutionData] = useState(null);
  const cameraRef = useRef(null);

  const handleCalculatorPress = (value) => {
    if (value === 'AC') {
      setCalcDisplay('0');
      return;
    }

    if (value === '=') {
      try {
        const sanitized = calcDisplay.replace(/×/g, '*').replace(/÷/g, '/').replace(/,/g, '.');
        const evalResult = eval(sanitized);
        setCalcDisplay(String(evalResult));
      } catch (err) {
        Alert.alert('Hata', 'Geçersiz işlem');
      }
      return;
    }

    if (value === '⌫') {
      setCalcDisplay(prev => (prev.length > 1 ? prev.slice(0, -1) : '0'));
      return;
    }

    setCalcDisplay(prev => (prev === '0' ? value : prev + value));
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.85,
        });
        setPhotoUri(photo.uri);
        setPhotoBase64(photo.base64);
      } catch (err) {
        Alert.alert('Çekim Hatası', 'Fotoğraf çekilirken bir sorun oluştu: ' + err.message);
      }
    }
  };

  const pickImageFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        base64: true,
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
        setPhotoBase64(result.assets[0].base64);
      }
    } catch (err) {
      Alert.alert('Galeri Hatası', 'Görsel seçilemedi: ' + err.message);
    }
  };

  const solveWithGemini = async () => {
    if (!photoBase64) {
      Alert.alert('Uyarı', 'Lütfen önce bir soru fotoğrafı çekin veya galeriden yükleyin.');
      return;
    }

    setLoading(true);
    setSolutionData(null);

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const prompt = `Görseldeki matematik veya geometri sorusunu tespit et ve Türkçe olarak adım adım çöz.
Lütfen yanıtı SADECE ve kesinlikle aşağıdaki geçerli JSON formatında ver, ekstra metin ekleme:
{
  "title": "Sorunun kısa başlığı veya konusu",
  "category": "Matematik kategorisi",
  "extractedQuestion": "Fotoğraftan algılanan sorunun metin hali",
  "formulasUsed": ["Kullanılan formül 1"],
  "stepByStepSolution": [
    {
      "stepNumber": 1,
      "title": "1. Adım",
      "explanation": "Açıklama",
      "mathFormula": "Denklem",
      "resultSnippet": "Ara sonuç"
    }
  ],
  "finalAnswer": "Nihai cevap",
  "teacherTip": "Sınav taktiği"
}`;

      const imagePart = {
        inlineData: {
          data: photoBase64,
          mimeType: 'image/jpeg',
        },
      };

      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      let rawText = response.text();
      rawText = rawText.replace(/```json/g, '').replace(/
        

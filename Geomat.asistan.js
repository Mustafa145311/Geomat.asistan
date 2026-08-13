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
  // Ekran Modu: 'calculator' veya 'ai_scanner'
  const [currentMode, setCurrentMode] = useState('calculator');

  // Hesap Makinesi State'leri
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [calcMode, setCalcMode] = useState('Temel'); // Temel veya Bilimsel

  // Kamera & AI State'leri
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState(null);
  const [photoBase64, setPhotoBase64] = useState(null);
  const [loading, setLoading] = useState(false);
  const [solutionData, setSolutionData] = useState(null);
  const cameraRef = useRef(null);

  // --------------------------------------------------------------------------
  // HESAP MAKİNESİ MANTIĞI
  // --------------------------------------------------------------------------
  const handleCalculatorPress = (value) => {
    if (value === 'AC') {
      setCalcDisplay('0');
      return;
    }

    if (value === '=') {
      try {
        // Güvenli hesaplama için eval yerine basit mantık veya eval kullanımı
        // Çarpı ve bölü işaretlerini JavaScript formatına çeviriyoruz
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

  // --------------------------------------------------------------------------
  // KAMERA VE AI İŞLEMLERİ
  // --------------------------------------------------------------------------
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
      rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

      const parsedJSON = JSON.parse(rawText);
      setSolutionData(parsedJSON);
    } catch (err) {
      Alert.alert('Hata', 'Gemini AI bağlantı hatası: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetScanner = () => {
    setPhotoUri(null);
    setPhotoBase64(null);
    setSolutionData(null);
  };

  // --------------------------------------------------------------------------
  // RENDER: HESAP MAKİNESİ EKRANI
  // --------------------------------------------------------------------------
  if (currentMode === 'calculator') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        
        {/* Üst Başlık & Pro Rozeti */}
        <View style={styles.calcHeader}>
          <View style={styles.calcHeaderLeft}>
            <View style={styles.calcIconBox}>
              <Text style={{ fontSize: 20 }}>🧮</Text>
            </View>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.calcTitle}>Hesap Makinesi</Text>
                <View style={styles.proBadge}><Text style={styles.proText}>PRO</Text></View>
              </View>
              <Text style={styles.calcSubtitle}>Gelişmiş & Matematiksel</Text>
            </View>
          </View>
        </View>

        {/* Mod Seçimleri & AI Soru Çöz Butonu */}
        <View style={styles.topBarActions}>
          <View style={styles.modeToggleRow}>
            <TouchableOpacity 
              style={[styles.modeBtn, calcMode === 'Temel' && styles.activeModeBtn]}
              onPress={() => setCalcMode('Temel')}
            >
              <Text style={[styles.modeText, calcMode === 'Temel' && styles.activeModeText]}>Temel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modeBtn, calcMode === 'Bilimsel' && styles.activeModeBtn]}
              onPress={() => setCalcMode('Bilimsel')}
            >
              <Text style={[styles.modeText, calcMode === 'Bilimsel' && styles.activeModeText]}>Bilimsel</Text>
            </TouchableOpacity>
          </View>

          {/* AI Soru Çözer Geçiş Butonu */}
          <TouchableOpacity 
            style={styles.aiJumpButton}
            onPress={() => {
              if (!permission?.granted && requestPermission) {
                requestPermission();
              }
              setCurrentMode('ai_scanner');
            }}
          >
            <Text style={styles.aiJumpButtonText}>✨ AI Soru Çözer</Text>
          </TouchableOpacity>
        </View>

        {/* Ekran (Display) */}
        <View style={styles.displayContainer}>
          <Text style={styles.displayText} numberOfLines={2} adjustsFontSizeToFit>
            {calcDisplay}
          </Text>
        </View>

        {/* Tuş Takımı (Keypad) */}
        <View style={styles.keypadContainer}>
          <View style={styles.row}>
            <TouchableOpacity style={styles.specialBtn} onPress={() => handleCalculatorPress('AC')}><Text style={styles.specialText}>AC</Text></TouchableOpacity>
            <TouchableOpacity style={styles.specialBtn} onPress={() => handleCalculatorPress('⌫')}><Text style={styles.specialText}>⌫</Text></TouchableOpacity>
            <TouchableOpacity style={styles.specialBtn} onPress={() => handleCalculatorPress('(')}><Text style={styles.specialText}>(</Text></TouchableOpacity>
            <TouchableOpacity style={styles.specialBtn} onPress={() => handleCalculatorPress(')')}><Text style={styles.specialText}>)</Text></TouchableOpacity>
          </View>
          <View style={styles.row}>
            <TouchableOpacity style={styles.numBtn} onPress={() => handleCalculatorPress('7')}><Text style={styles.numText}>7</Text></TouchableOpacity>
            <TouchableOpacity style={styles.numBtn} onPress={() => handleCalculatorPress('8')}><Text style={styles.numText}>8</Text></TouchableOpacity>
            <TouchableOpacity style={styles.numBtn} onPress={() => handleCalculatorPress('9')}><Text style={styles.numText}>9</Text></TouchableOpacity>
            <TouchableOpacity style={styles.opBtn} onPress={() => handleCalculatorPress('÷')}><Text style={styles.opText}>÷</Text></TouchableOpacity>
          </View>
          <View style={styles.row}>
            <TouchableOpacity style={styles.numBtn} onPress={() => handleCalculatorPress('4')}><Text style={styles.numText}>4</Text></TouchableOpacity>
            <TouchableOpacity style={styles.numBtn} onPress={() => handleCalculatorPress('5')}><Text style={styles.numText}>5</Text></TouchableOpacity>
            <TouchableOpacity style={styles.numBtn} onPress={() => handleCalculatorPress('6')}><Text style={styles.numText}>6</Text></TouchableOpacity>
            <TouchableOpacity style={styles.opBtn} onPress={() => handleCalculatorPress('×')}><Text style={styles.opText}>×</Text></TouchableOpacity>
          </View>
          <View style={styles.row}>
            <TouchableOpacity style={styles.numBtn} onPress={() => handleCalculatorPress('1')}><Text style={styles.numText}>1</Text></TouchableOpacity>
            <TouchableOpacity style={styles.numBtn} onPress={() => handleCalculatorPress('2')}><Text style={styles.numText}>2</Text></TouchableOpacity>
            <TouchableOpacity style={styles.numBtn} onPress={() => handleCalculatorPress('3')}><Text style={styles.numText}>3</Text></TouchableOpacity>
            <TouchableOpacity style={styles.opBtn} onPress={() => handleCalculatorPress('-')}><Text style={styles.opText}>-</Text></TouchableOpacity>
          </View>
          <View style={styles.row}>
            <TouchableOpacity style={styles.numBtn} onPress={() => handleCalculatorPress('0')}><Text style={styles.numText}>0</Text></TouchableOpacity>
            <TouchableOpacity style={styles.numBtn} onPress={() => handleCalculatorPress(',')}><Text style={styles.numText}>,</Text></TouchableOpacity>
            <TouchableOpacity style={styles.equalBtn} onPress={() => handleCalculatorPress('=')}><Text style={styles.equalText}>=</Text></TouchableOpacity>
            <TouchableOpacity style={styles.opBtn} onPress={() => handleCalculatorPress('+')}><Text style={styles.opText}>+</Text></TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // --------------------------------------------------------------------------
  // RENDER: AI KAMERA / SORU ÇÖZÜCÜ EKRANI
  // --------------------------------------------------------------------------
  if (!permission?.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>Kamera İzni Gerekli</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>İzin Ver</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.primaryButton, { backgroundColor: '#334155', marginTop: 10 }]} onPress={() => setCurrentMode('calculator')}>
          <Text style={styles.primaryButtonText}>Geri Dön</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      
      {/* Üst Başlık & Geri Dönüş */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentMode('calculator')} style={styles.backBtn}>
          <Text style={{ color: '#818cf8', fontWeight: 'bold' }}>⬅ Hesap Makinesi</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Matematik AI Asistanı</Text>
      </View>

      {!photoUri ? (
        <View style={styles.cameraWrapper}>
          <CameraView style={styles.camera} ref={cameraRef}>
            <View style={styles.cameraOverlay}>
              <View style={styles.scanFrame} />
              <Text style={styles.scanInstruction}>Soruyu çerçeveye oturtun</Text>
            </View>
          </CameraView>
          <View style={styles.bottomControlBar}>
            <TouchableOpacity style={styles.galleryButton} onPress={pickImageFromGallery}>
              <Text style={styles.galleryButtonText}>Galeri</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.captureOuterCircle} onPress={takePicture}>
              <View style={styles.captureInnerCircle} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Image source={{ uri: photoUri }} style={styles.previewImage} />
          {!solutionData ? (
            <View style={styles.actionBox}>
              <TouchableOpacity
                style={[styles.solveButton, loading && styles.disabledButton]}
                onPress={solveWithGemini}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.solveButtonText}>✨ Gemini AI ile Çöz</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.retakeButton} onPress={resetScanner}>
                <Text style={styles.retakeButtonText}>Yeniden Çek</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.solutionContainer}>
              <View style={styles.solutionHeaderCard}>
                <Text style={styles.solutionTitle}>{solutionData.title}</Text>
                <Text style={styles.badgeText}>{solutionData.category}</Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardHeader}>Soru:</Text>
                <Text style={styles.questionText}>{solutionData.extractedQuestion}</Text>
              </View>
              {solutionData.stepByStepSolution?.map((step) => (
                <View key={step.stepNumber} style={styles.stepCard}>
                  <Text style={styles.stepTitle}>Adım {step.stepNumber}: {step.title}</Text>
                  <Text style={styles.stepExplanation}>{step.explanation}</Text>
                </View>
              ))}
              <View style={styles.finalAnswerCard}>
                <Text style={styles.finalAnswerLabel}>NİHAİ CEVAP</Text>
                <Text style={styles.finalAnswerValue}>{solutionData.finalAnswer}</Text>
              </View>
              <TouchableOpacity style={styles.newSolveButton} onPress={resetScanner}>
                <Text style={styles.newSolveButtonText}>Yeni Soru Çöz</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ============================================================================
// STİLLER
// ============================================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  calcHeader: { padding: 16, backgroundColor: '#1e293b', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calcHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  calcIconBox: { width: 40, height: 40, backgroundColor: '#312e81', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  calcTitle: { fontSize: 18, fontWeight: 'bold', color: '#f8fafc' },
  calcSubtitle: { fontSize: 11, color: '#94a3b8' },
  proBadge: { backgroundColor: '#064e3b', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  proText: { color: '#34d399', fontSize: 10, fontWeight: 'bold' },
  topBarActions: { padding: 12, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155', gap: 10 },
  modeToggleRow: { flexDirection: 'row', backgroundColor: '#0f172a', padding: 4, borderRadius: 10 },
  modeBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  activeModeBtn: { backgroundColor: '#334155' },
  modeText: { color: '#94a3b8', fontWeight: 'bold', fontSize: 13 },
  activeModeText: { color: '#f8fafc' },
  aiJumpButton: { backgroundColor: '#6366f1', padding: 12, borderRadius: 12, alignItems: 'center' },
  aiJumpButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  displayContainer: { flex: 1, justifyContent: 'flex-end', padding: 24, alignItems: 'flex-end' },
  displayText: { color: '#ffffff', fontSize: 48, fontWeight: '300' },
  keypadContainer: { padding: 12, gap: 10, backgroundColor: '#0f172a' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  numBtn: { flex: 1, backgroundColor: '#1e293b', aspectRatio: 1.3, justifyContent: 'center', alignItems: 'center', borderRadius: 16 },
  numText: { color: '#f8fafc', fontSize: 22, fontWeight: 'bold' },
  opBtn: { flex: 1, backgroundColor: '#1e293b', aspectRatio: 1.3, justifyContent: 'center', alignItems: 'center', borderRadius: 16 },
  opText: { color: '#38bdf8', fontSize: 24, fontWeight: 'bold' },
  specialBtn: { flex: 1, backgroundColor: '#1e293b', aspectRatio: 1.3, justifyContent: 'center', alignItems: 'center', borderRadius: 16 },
  specialText: { color: '#f43f5e', fontSize: 18, fontWeight: 'bold' },
  equalBtn: { flex: 2.1, backgroundColor: '#10b981', aspectRatio: 2.8, justifyContent: 'center', alignItems: 'center', borderRadius: 16 },
  equalText: { color: '#ffffff', fontSize: 26, fontWeight: 'bold' },
  header: { padding: 14, backgroundColor: '#1e293b', flexDirection: 'row', alignItems: 'center', gap: 16 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#818cf8' },
  cameraWrapper: { flex: 1 },
  camera: { flex: 1 },
  cameraOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'center', alignItems: 'center' },
  scanFrame: { width: 280, height: 200, borderWidth: 2, borderColor: '#818cf8', borderRadius: 20, borderStyle: 'dashed' },
  scanInstruction: { color: '#fff', marginTop: 12, backgroundColor: 'rgba(0,0,0,0.6)', padding: 6, borderRadius: 8 },
  bottomControlBar: { height: 100, backgroundColor: '#0f172a', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  galleryButton: { backgroundColor: '#1e293b', padding: 12, borderRadius: 12 },
  galleryButtonText: { color: '#fff' },
  captureOuterCircle: { width: 70, height: 70, borderRadius: 35, borderWidth: 3, borderColor: '#818cf8', justifyContent: 'center', alignItems: 'center' },
  captureInnerCircle: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#818cf8' },
  scrollContent: { padding: 16 },
  previewImage: { width: '100%', height: 220, borderRadius: 14, marginBottom: 16 },
  actionBox: { gap: 10 },
  solveButton: { backgroundColor: '#6366f1', padding: 16, borderRadius: 14, alignItems: 'center' },
  disabledButton: { opacity: 0.7 },
  solveButtonText: { color: '#fff', fontWeight: 'bold' },
  retakeButton: { backgroundColor: '#1e293b', padding: 14, borderRadius: 14, alignItems: 'center' },
  retakeButtonText: { color: '#94a3b8' },
  solutionContainer: { gap: 10 },
  solutionHeaderCard: { backgroundColor: '#1e293b', padding: 14, borderRadius: 12 },
  solutionTitle: { color: '#fff', fontSize: 18, fontWeigh

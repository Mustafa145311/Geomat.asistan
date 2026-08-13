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
// API anahtarınızı aşağıya yazabilir veya .env dosyanızdan alabilirsiniz.
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY_HERE';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState(null);
  const [photoBase64, setPhotoBase64] = useState(null);
  const [loading, setLoading] = useState(false);
  const [solutionData, setSolutionData] = useState(null);
  const cameraRef = useRef(null);

  // --------------------------------------------------------------------------
  // KAMERA İZİN KONTROLÜ
  // --------------------------------------------------------------------------
  if (!permission) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <View style={styles.permissionCard}>
          <Text style={styles.permissionTitle}>Kamera İzni Gerekli</Text>
          <Text style={styles.permissionText}>
            Matematik ve geometri sorularını tarayarak hızlıca çözebilmek için uygulamanın kameraya erişmesine izin vermelisiniz.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
            <Text style={styles.primaryButtonText}>Kamera İznini Onayla</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // --------------------------------------------------------------------------
  // KAMERADAN FOTOĞRAF ÇEKME
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

  // --------------------------------------------------------------------------
  // GALERİDEN FOTOĞRAF SEÇME
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // GEMINI API ILE FOTOĞRAFI ANALİZ ETME VE SORUYU ÇÖZME
  // --------------------------------------------------------------------------
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
  "category": "Matematik kategorisi (örn: Geometri, Türev, İntegral, İkinci Dereceden Denklem)",
  "extractedQuestion": "Fotoğraftan algılanan sorunun metin hali",
  "formulasUsed": ["Kullanılan formül 1", "Kullanılan formül 2"],
  "stepByStepSolution": [
    {
      "stepNumber": 1,
      "title": "1. Adım Başlığı",
      "explanation": "Bu adımda yapılan işlemin açıklaması",
      "mathFormula": "Eşitlik veya denklem",
      "resultSnippet": "Ara sonuç"
    }
  ],
  "finalAnswer": "Sorunun nihai net cevabı",
  "teacherTip": "Öğrenciye sınav taktiği veya püf noktası"
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

      // JSON formatını temizleme
      rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

      const parsedJSON = JSON.parse(rawText);
      setSolutionData(parsedJSON);
    } catch (err) {
      console.error('Gemini API Error:', err);
      Alert.alert(
        'Çözüm Oluşturulamadı',
        'Gemini AI ile bağlantı sırasında bir hata oluştu. Lütfen API anahtarınızı kontrol edip tekrar deneyiniz.\n\nDetay: ' + err.message
      );
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
  // EKRAN RENDER MANTIĞI
  // --------------------------------------------------------------------------
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Matematik AI Asistanı</Text>
        <Text style={styles.headerSubtitle}>Gemini Destekli Soru Çözer</Text>
      </View>

      {/* KAMERA VEYA ÖNİZLEME/ÇÖZÜM EKRANI */}
      {!photoUri ? (
        // 1. CANLI KAMERA EKRANI
        <View style={styles.cameraWrapper}>
          <CameraView style={styles.camera} ref={cameraRef}>
            <View style={styles.cameraOverlay}>
              <View style={styles.scanFrame} />
              <Text style={styles.scanInstruction}>
                Soruyu kesikli hiza çerçevesine oturtun
              </Text>
            </View>
          </CameraView>

          {/* ALT BUTONLAR BAR BÖLÜMÜ */}
          <View style={styles.bottomControlBar}>
            <TouchableOpacity style={styles.galleryButton} onPress={pickImageFromGallery}>
              <Text style={styles.galleryButtonText}>Galeriden Seç</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.captureOuterCircle} onPress={takePicture}>
              <View style={styles.captureInnerCircle} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // 2. FOTOĞRAF ÖNİZLEME VEYA ÇÖZÜM EKRANI
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Çekilen Fotoğraf */}
          <Image source={{ uri: photoUri }} style={styles.previewImage} />

          {!solutionData ? (
            // Çöz Butonu Görünümü
            <View style={styles.actionBox}>
              <TouchableOpacity
                style={[styles.solveButton, loading && styles.disabledButton]}
                onPress={solveWithGemini}
                disabled={loading}
              >
                {loading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color="#ffffff" />
                    <Text style={styles.solveButtonText}> Soru Analiz Ediliyor...</Text>
                  </View>
                ) : (
                  <Text style={styles.solveButtonText}>✨ Gemini AI ile Yapay Zekaya Çözdür</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.retakeButton} onPress={resetScanner} disabled={loading}>
                <Text style={styles.retakeButtonText}>Fotoğrafı Yeniden Çek</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // Gemini AI Çözüm Sonucu
            <View style={styles.solutionContainer}>
              <View style={styles.solutionHeaderCard}>
                <Text style={styles.solutionTitle}>{solutionData.title || 'Soru Çözümü'}</Text>
                {solutionData.category && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{solutionData.category}</Text>
                  </View>
                )}
              </View>

              {/* Algılanan Soru */}
              <View style={styles.card}>
                <Text style={styles.cardHeader}>Tespit Edilen Soru Metni:</Text>
                <Text style={styles.questionText}>{solutionData.extractedQuestion}</Text>
              </View>

              {/* Kullanılan Formüller */}
              {solutionData.formulasUsed && solutionData.formulasUsed.length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.cardHeader}>Kullanılan Formüller:</Text>
                  {solutionData.formulasUsed.map((formula, idx) => (
                    <Text key={idx} style={styles.formulaText}>• {formula}</Text>
                  ))}
                </View>
              )}

              {/* Adım Adım Çözüm */}
              <Text style={styles.sectionTitle}>Adım Adım Çözüm Yolu:</Text>
              {solutionData.stepByStepSolution?.map((step) => (
                <View key={step.stepNumber} style={styles.stepCard}>
                  <Text style={styles.stepTitle}>
                    Adım {step.stepNumber}: {step.title}
                  </Text>
                  <Text style={styles.stepExplanation}>{step.explanation}</Text>
                  {step.mathFormula && (
                    <View style={styles.mathBox}>
                      <Text style={styles.mathText}>{step.mathFormula}</Text>
                    </View>
                  )}
                </View>
              ))}

              {/* Nihai Cevap */}
              <View style={styles.finalAnswerCard}>
                <Text style={styles.finalAnswerLabel}>NİHAİ CEVAP</Text>
                <Text style={styles.finalAnswerValue}>{solutionData.finalAnswer}</Text>
              </View>

              {/* Öğretmen İpucu */}
              {solutionData.teacherTip && (
                <View style={styles.tipCard}>
                  <Text style={styles.tipTitle}>💡 Öğretmenin Sınav Taktiği:</Text>
                  <Text style={styles.tipText}>{solutionData.teacherTip}</Text>
                </View>
              )}

              {/* Yeni Soru Çözme Butonu */}
              <TouchableOpacity style={styles.newSolveButton} onPress={resetScanner}>
                <Text style={styles.newSolveButtonText}>Yeni Soru Çek / Yükle</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ============================================================================
// STİL TANIMLARI
// ============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#818cf8',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionCard: {
    backgroundColor: '#1e293b',
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 12,
  },
  permissionText: {
    fontSize: 14,
    color: '#cbd5e1',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  cameraWrapper: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 300,
    height: 220,
    borderWidth: 2,
    borderColor: '#818cf8',
    borderRadius: 20,
    borderStyle: 'dashed',
  },
  scanInstruction: {
    color: '#f1f5f9',
    marginTop: 16,
    fontSize: 13,
    fontWeight: 'bold',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  bottomControlBar: {
    height: 110,
    backgroundColor: '#0f172a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  galleryButton: {
    backgroundColor: '#1e293b',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  galleryButtonText: {
    color: '#cbd5e1',
    fontWeight: 'bold',
    fontSize: 13,
  },
  captureOuterCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#818cf8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInnerCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#818cf8',
  },
  scrollContent: {
    padding: 16,
  },
  previewImage: {
    width: '100%',
    height: 240,
    borderRadius: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  actionBox: {
    gap: 12,
  },
  solveButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 4,
  },
  disabledButton: {
    opacity: 0.7,
  },
  solveButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  retakeButton: {
    backgroundColor: '#1e293b',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  retakeButtonText: {
    color: '#94a3b8',
    fontWeight: 'bold',
    fontSize: 14,
  },
  solutionContainer: {
    gap: 12,
  },
  solutionHeaderCard: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  solutionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#312e81',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
  },
  badgeText: {
    color: '#a5b4fc',
    fontSize: 12,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#1e293b',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  questionText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  formulaText: {
    color: '#38bdf8',
    fontSize: 13,
    fontFamily: 'monospace',
    marginTop: 4,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
  },
  stepCard: {
    backgroundColor: '#1e293b',
    padding: 14,
    borderRadius: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#6366f1',
  },
  stepTitle: {
    color: '#818cf8',
    fontWeight: 'bold',
    fontSize: 15,
  },
  stepExplanation: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  mathBox: {
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  mathText: {
    color: '#f43f5e',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 13,
  },
  finalAnswerCard: {
    backgroundColor: '#312e81',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4338ca',
    marginTop: 6,
  },
  finalAnswerLabel: {
    color: '#a5b4fc',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  finalAnswerValue: {
    color: '#38bdf8',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 4,
    textAlign: 'center',
  },
  tipCard: {
    backgroundColor: '#064e3b',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#059669',
  },
  tipTitle: {
    color: '#34d399',
    fontWeight: 'bold',
    fontSize: 13,
  },
  tipText: {
    color: '#a7f3d0',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  newSolveButton: {
    backgroundColor: '#4f46e5',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  newSolveButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 15,
  },
});
import { registerRootComponent } from 'expo';
registerRootComponent(App);

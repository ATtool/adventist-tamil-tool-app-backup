import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Platform, LayoutAnimation, UIManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../context/SettingsContext';

// Import your existing InAppBrowser component (adjust path if needed)
import InAppBrowser from '../components/InAppBrowser'; 

// Enable LayoutAnimation for Android smooth expanding panels
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// -------------------------------------------------------------
// Translations Dictionary
// -------------------------------------------------------------
const T = {
  en: {
    header: "About App",
    langToggle: "தமிழ்",
    missionTitle: "Welcome to Adventist Tamil Tools! 😇",
    moto: '"Let\'s expand on the concept of deepening our understanding of the Bible and enhancing our knowledge of its teachings."',
    body1: "We’re truly glad you’ve joined us on this journey. This platform aims to provide valuable Tamil Adventist resources & original source links that can inspire and uplift your spiritual path.",
    isaiah: '"How beautiful upon the mountains are the feet of him that bringeth good tidings, that publisheth peace..."',
    isaiahRef: "- Isaiah 52:7",
    egw: '"When we bring our hearts into unity with Christ and our lives into harmony with His work, the Spirit that fell on the disciples on the Day of Pentecost will fall on us..."',
    egwRef: "- Ellen G. White",
    body2: "We hope this site serves as a source of inspiration for you, empowering you to be a beacon of God’s love and truth in the world.",
    humbleTitle: "A Humble Note",
    humbleBody: "Dear friends, we want to let you know that most of the materials and links shared on this platform are not created by Adventist Tamil Tools. We are simply bringing together resources from various creators and redirecting you to their original websites, with the hope that these blessings will enrich your spiritual journey.",
    warn1: "The application is not endorsed by the Seventh-Day Adventist Church.",
    warn2: "The Copyright of the song lyrics used in this e-song book application belong to the respective Copyright holders.",
    contribTitle: "Contributors",
    dev: "Developer",
    mag: "Chittukuruvi Magazine",
    magDesc: "Published by Danny’s Publications on behalf of God is Judge Ministries. Nagercoil – 629004.",
    thanglish: "Thanglish Song Titles",
    thanglishDesc: "SDA Teacher, Co-founder of Balams Donkey Ministry.",
    attrTitle: "Data Sources & Attributions",
    viewSource: "View Source",
  },
  ta: {
    header: "செயலியைப் பற்றி",
    langToggle: "English",
    missionTitle: "அட்வென்டிஸ்ட் தமிழ் டூல்ஸ்-க்கு உங்களை வரவேற்கிறோம்! 😇",
    moto: '"வேதாகமத்தை பற்றிய நமது புரிதலை ஆழப்படுத்துவோம், அதன் போதனைகள் பற்றிய அறிவை விரிவுபடுத்துவோம்."',
    body1: "இந்தப் பயணத்தில் நீங்கள் எங்களோடு இணைந்ததில் நாங்கள் மிகவும் மகிழ்ச்சியடைகிறோம். உங்கள் ஆவிக்குரிய பயணத்தை ஊக்குவிக்கவும் உயர்த்தவும் உதவும் மதிப்புமிக்க தமிழ் அட்வென்டிஸ்ட் வளங்கள் மற்றும் அசல் மூல இணைப்புகளை வழங்குவதே இந்த தளத்தின் நோக்கமாகும்.",
    isaiah: '"சமாதானத்தைக் கூறி, நற்காரியங்களைச் சுவிசேஷமாய் அறிவித்து, இரட்சிப்பைப் பிரசித்தப்படுத்தி... சுவிசேஷகனுடைய பாதங்கள் மலைகளின்மேல் எவ்வளவு அழகாயிருக்கின்றன."',
    isaiahRef: "- ஏசாயா 52:7",
    egw: '"நாம் நமது இருதயங்களைக் கிறிஸ்துவோடு ஒன்றிணைத்து, நமது வாழ்க்கையை அவருடைய வேலையோடு இசைவாக்கும்போது, பெந்தெகொஸ்தே நாளில் சீஷர்கள் மேல் ஊற்றப்பட்ட அதே ஆவியானவர் நம் மீதும் ஊற்றப்படுவார்..."',
    egwRef: "- எலன் ஜி. ஒயிட்",
    body2: "இந்த தளம் உங்களுக்கு ஒரு உத்வேகமாக அமைந்து, உலகில் தேவ அன்பிற்கும் சத்தியத்திற்கும் ஒரு வெளிச்சமாக மாற உங்களை பலப்படுத்தும் என நம்புகிறோம்.",
    humbleTitle: "ஒரு அன்பான குறிப்பு",
    humbleBody: "அன்பான நண்பர்களே, இந்த தளத்தில் பகிரப்படும் பெரும்பாலான பொருட்கள் மற்றும் இணைப்புகள் எங்களால் உருவாக்கப்பட்டவை அல்ல. பல்வேறு படைப்பாளிகளின் வளங்களை ஒன்றிணைத்து, அவர்களின் அசல் தளங்களுக்கு உங்களை வழிநடத்துகிறோம்.",
    warn1: "இந்தச் செயலி செவன்த்-டே அட்வென்டிஸ்ட் திருச்சபையால் அதிகாரப்பூர்வமாக அங்கீகரிக்கப்பட்டதல்ல.",
    warn2: "இதில் பயன்படுத்தப்பட்டுள்ள பாடல் வரிகளின் பதிப்புரிமை அந்தந்த பதிப்புரிமையாளர்களைச் சாரும்.",
    contribTitle: "பங்களிப்பாளர்கள்",
    dev: "உருவாக்குநர்",
    mag: "சிட்டுக்குருவி இதழ்",
    magDesc: "Danny’s Publications மற்றும் God is Judge Ministries சார்பாக வெளியிடப்பட்டது. நாகர்கோவில் – 629004.",
    thanglish: "தங்க்லீஷ் பாடல் தலைப்புகள்",
    thanglishDesc: "SDA ஆசிரியை, Balams Donkey Ministry-ன் இணை நிறுவனர்.",
    attrTitle: "தரவு மூலங்கள் மற்றும் உரிமைகள்",
    viewSource: "மூலத்தைக் காண்க",
  }
};

// -------------------------------------------------------------
// Reusable Premium Click Animation Wrapper
// -------------------------------------------------------------
const ScalePressable = ({ children, onPress, style, scaleTo = 0.95, disabled = false }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => !disabled && Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, friction: 5 }).start();
  const handlePressOut = () => !disabled && Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <TouchableOpacity onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={onPress} activeOpacity={0.8} delayPressIn={50} disabled={disabled}>
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function AboutScreen({ navigation }) {
  const { colors, appFontSize } = useSettings();
  
  // States
  const [lang, setLang] = useState('en');
  const [expandedSection, setExpandedSection] = useState('welcome'); 
  
  // In-App Browser States
  const [browserVisible, setBrowserVisible] = useState(false);
  const [browserUrl, setBrowserUrl] = useState('');
  const [browserTitle, setBrowserTitle] = useState('');

  // Entrance Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true })
    ]).start();
  }, []);

  const toggleLanguage = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setLang(lang === 'en' ? 'ta' : 'en');
  };

  const toggleSection = (section) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSection(prev => prev === section ? null : section);
  };

  const openWebLink = (url, title) => {
    setBrowserUrl(url);
    setBrowserTitle(title);
    setBrowserVisible(true);
  };

  const text = T[lang];

  // -------------------------------------------------------------
  // Reusable Accordion Card Component
  // -------------------------------------------------------------
  const AccordionCard = ({ id, title, icon, color, bgColor, children }) => {
    const isExpanded = expandedSection === id;
    return (
      <View style={[styles.card, { backgroundColor: bgColor || colors.card, borderColor: color || colors.border }]}>
        <ScalePressable onPress={() => toggleSection(id)}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name={icon} size={24} color={color || colors.primary} />
              <Text style={[styles.cardTitle, { color: color || colors.text }]} numberOfLines={1}>{title}</Text>
            </View>
            <View style={[styles.iconCircle, { backgroundColor: color ? `${color}20` : 'rgba(0, 240, 255, 0.1)' }]}>
              <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={color || colors.primary} />
            </View>
          </View>
        </ScalePressable>
        
        {isExpanded && (
          <View style={styles.cardContent}>
            {children}
          </View>
        )}
      </View>
    );
  };

  const AttributionItem = ({ title, desc, url }) => (
    <View style={styles.attrItem}>
      <View style={styles.attrDot} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.attrTitle, { color: colors.text }]}>{title}</Text>
        {desc && <Text style={[styles.attrDesc, { color: colors.subtext }]}>{desc}</Text>}
        {url && (
          <TouchableOpacity onPress={() => openWebLink(url, title)} style={{ marginTop: 6, alignSelf: 'flex-start' }}>
            <View style={[styles.sourceBtn, { borderColor: colors.primary }]}>
              <Ionicons name="link" size={14} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 12, marginLeft: 4, fontWeight: 'bold' }}>{text.viewSource}</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* HEADER */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <ScalePressable onPress={() => navigation.goBack()}>
          <View style={{ padding: 5 }}>
            <Ionicons name="arrow-back" size={26} color={colors.text} />
          </View>
        </ScalePressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{text.header}</Text>
        
        <ScalePressable onPress={toggleLanguage}>
          <View style={[styles.langBtn, { borderColor: colors.primary }]}>
            <Ionicons name="language" size={14} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 12, marginLeft: 4 }}>{text.langToggle}</Text>
          </View>
        </ScalePressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          
          {/* SECTION 1: MISSION & WELCOME */}
          <AccordionCard id="welcome" title={text.missionTitle} icon="leaf">
            <Text style={[styles.motoText, { color: colors.primary, fontSize: appFontSize + 2 }]}>{text.moto}</Text>
            <Text style={[styles.bodyText, { color: colors.text, fontSize: appFontSize }]}>{text.body1}</Text>

            <View style={[styles.quoteBox, { backgroundColor: 'rgba(76, 175, 80, 0.1)', borderLeftColor: '#4CAF50' }]}>
              <Text style={[styles.quoteText, { color: colors.text, fontSize: appFontSize - 1 }]}>{text.isaiah}</Text>
              <Text style={[styles.quoteRef, { color: '#4CAF50' }]}>{text.isaiahRef}</Text>
            </View>

            <View style={[styles.quoteBox, { backgroundColor: 'rgba(0, 240, 255, 0.1)', borderLeftColor: colors.primary }]}>
              <Text style={[styles.quoteText, { color: colors.text, fontSize: appFontSize - 1 }]}>{text.egw}</Text>
              <Text style={[styles.quoteRef, { color: colors.primary }]}>{text.egwRef}</Text>
            </View>

            <Text style={[styles.bodyText, { color: colors.text, fontSize: appFontSize, marginTop: 15 }]}>{text.body2}</Text>
          </AccordionCard>

          {/* SECTION 2: DISCLAIMER */}
          <AccordionCard id="disclaimer" title={text.humbleTitle} icon="information-circle" color="#FF9800" bgColor="rgba(255, 152, 0, 0.05)">
            <Text style={[styles.bodyText, { color: colors.text, fontSize: appFontSize }]}>{text.humbleBody}</Text>
            <View style={{ height: 1, backgroundColor: 'rgba(255, 152, 0, 0.2)', marginVertical: 15 }} />
            <Text style={[styles.disclaimerText, { color: '#FF5252' }]}>
              <Ionicons name="warning" size={16} color="#FF5252" /> {text.warn1}
            </Text>
            <Text style={[styles.disclaimerText, { color: colors.subtext, marginTop: 8 }]}>{text.warn2}</Text>
          </AccordionCard>

          {/* SECTION 3: CONTRIBUTORS */}
          <AccordionCard id="contributors" title={text.contribTitle} icon="people">
            
            <View style={styles.contributorBox}>
              <Text style={[styles.contributorRole, { color: colors.subtext }]}>{text.dev}</Text>
              <Text style={[styles.contributorName, { color: colors.text }]}>Pr. KSM</Text>
              <ScalePressable onPress={() => openWebLink('mailto:adventisttamiltool@gmail.com', 'Contact Us')}>
                <View style={[styles.contactBtn, { backgroundColor: 'rgba(0, 240, 255, 0.1)' }]}>
                  <Ionicons name="mail" size={16} color={colors.primary} />
                  <Text style={[styles.contactBtnText, { color: colors.primary }]}>adventisttamiltool@gmail.com</Text>
                </View>
              </ScalePressable>
            </View>

            <View style={styles.contributorBox}>
              <Text style={[styles.contributorRole, { color: colors.subtext }]}>{text.mag}</Text>
              <Text style={[styles.contributorName, { color: colors.text }]}>Mr. Allan Anbarasan</Text>
              <Text style={[styles.contributorDesc, { color: colors.subtext }]}>{text.magDesc}</Text>
              <ScalePressable onPress={() => openWebLink('https://api.whatsapp.com/send/?phone=918904072759&text&type=phone_number&app_absent=0', 'WhatsApp Chat')}>
                <View style={[styles.contactBtn, { backgroundColor: 'rgba(37, 211, 102, 0.1)' }]}>
                  <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                  <Text style={[styles.contactBtnText, { color: "#25D366" }]}>WhatsApp: +91 89040 72759</Text>
                </View>
              </ScalePressable>
            </View>

            <View style={[styles.contributorBox, { borderBottomWidth: 0, paddingBottom: 0, marginBottom: 0 }]}>
              <Text style={[styles.contributorRole, { color: colors.subtext }]}>{text.thanglish}</Text>
              <Text style={[styles.contributorName, { color: colors.text }]}>Miss. Hanly</Text>
              <Text style={[styles.contributorDesc, { color: colors.subtext }]}>{text.thanglishDesc}</Text>
            </View>

          </AccordionCard>

          {/* SECTION 4: RESOURCE ATTRIBUTIONS */}
          <AccordionCard id="attributions" title={text.attrTitle} icon="library">
            <AttributionItem title="English Bible Versions" url="https://github.com/scrollmapper/bible_databases" />
            <AttributionItem title="Bible Dictionary (Converted from XML)" url="https://github.com/neuu-org/bible-dictionary-dataset" />
            <AttributionItem title="SDA International Biblical-Theological Dictionary" url="https://dictionary.adventist.org/" />
            <AttributionItem title="Bible Concordance (KJV.db)" desc="Strongs mappings, HebrewStrong.xml, and strongsgreek.xml used for references." url="https://github.com/scrollmapper/bible_databases/tree/master/sources/en/KJV" />
            <AttributionItem title="Bible Commentary" desc="Matthew Henry Complete Commentary" url="https://www.biblesnet.com/matthew_henry_download.html" />
            <AttributionItem title="Study Explanations" url="https://bibletool.info" />
            <AttributionItem title="Song Books" desc="Copied from the official SDA 'Seeyon Iniya Geethangal' and 'Thirumarai Thirupaadalgal' Song Books." />
          </AccordionCard>

        </Animated.View>
      </ScrollView>

      {/* IN-APP BROWSER OVERLAY */}
      <InAppBrowser 
        visible={browserVisible} 
        url={browserUrl} 
        title={browserTitle} 
        onClose={() => setBrowserVisible(false)} 
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  langBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  scrollContent: { padding: 15, paddingBottom: 50 },

  card: { borderRadius: 16, borderWidth: 1, marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 4, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', marginLeft: 10, flex: 1 },
  iconCircle: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  cardContent: { padding: 20, paddingTop: 0 },

  motoText: { fontStyle: 'italic', fontWeight: 'bold', textAlign: 'center', marginBottom: 20, lineHeight: 28 },
  bodyText: { lineHeight: 24, textAlign: 'justify' },

  quoteBox: { marginTop: 15, padding: 15, borderRadius: 10, borderLeftWidth: 4 },
  quoteText: { fontStyle: 'italic', lineHeight: 22 },
  quoteRef: { marginTop: 10, fontWeight: 'bold', fontSize: 13, textAlign: 'right' },

  disclaimerText: { fontSize: 13, lineHeight: 20, fontWeight: '600' },

  contributorBox: { paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', marginBottom: 15 },
  contributorRole: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  contributorName: { fontSize: 18, fontWeight: 'bold' },
  contributorDesc: { fontSize: 13, marginTop: 4, lineHeight: 20 },
  contactBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginTop: 10 },
  contactBtnText: { marginLeft: 8, fontSize: 13, fontWeight: 'bold' },

  attrItem: { flexDirection: 'row', marginBottom: 20 },
  attrDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(0, 240, 255, 0.5)', marginTop: 6, marginRight: 12 },
  attrTitle: { fontSize: 15, fontWeight: 'bold' },
  attrDesc: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  sourceBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 }
});

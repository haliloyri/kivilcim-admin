import React, { useState, useEffect } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, BookOpen, Layers, Users, FileText, ChevronLeft, ChevronRight, Search, X, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Share2, DownloadCloud, Sparkles, Database, Cloud, HardDrive, Table, ChevronDown, RefreshCw } from 'lucide-react';
import { toPng } from 'html-to-image';
import './index.css';

function App() {
  const [activeTab, setActiveTab] = useState('kitap'); // kitap, yazar, kategori, hikaye, ceviri, supabase
  const [activeSection, setActiveSection] = useState('localdb'); // 'localdb' | 'supabase'
  const [supabaseOpenSection, setSupabaseOpenSection] = useState(true);
  const [localDbOpenSection, setLocalDbOpenSection] = useState(true);
  // Supabase tables viewer
  const [supaTableActive, setSupaTableActive] = useState(null); // null | table name
  const [supaTableData, setSupaTableData] = useState([]);
  const [supaTableLoading, setSupaTableLoading] = useState(false);
  const [supaTableCols, setSupaTableCols] = useState([]);
  const [supaTableCounts, setSupaTableCounts] = useState({});
  // Supabase stories specific viewer
  const [supaStoriesLang, setSupaStoriesLang] = useState('tr');
  const [supaStoriesSearch, setSupaStoriesSearch] = useState('');
  const [supaStoriesDetail, setSupaStoriesDetail] = useState(null); // selected story_id
  const [supaStoriesDetailLang, setSupaStoriesDetailLang] = useState('tr');
  const [supaStoriesDetailTab, setSupaStoriesDetailTab] = useState('icerik'); // 'icerik' | 'sohbet'
  const [selectedStory, setSelectedStory] = useState(null);
  const [modalLang, setModalLang] = useState('tr');
  const [selectedStoryTranslations, setSelectedStoryTranslations] = useState({});
  const [currentLang, setCurrentLang] = useState('tr'); // tr, en, de, es

  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [authors, setAuthors] = useState([]);
  const [stories, setStories] = useState([]);
  const [sharePreviewStory, setSharePreviewStory] = useState(null);
  const shareCardRef = React.useRef(null);

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [scrollProgress, setScrollProgress] = useState(0);

  // Translation State
  const [translationStats, setTranslationStats] = useState({
    stories: { total: 0, translated: { tr: 0, en: 0, de: 0, es: 0 } },
    books: { total: 0, translated: { tr: 0, en: 0, de: 0, es: 0 } },
    categories: { total: 0, translated: { tr: 0, en: 0, de: 0, es: 0 } }
  });
  const [translationLogs, setTranslationLogs] = useState({ stories: [], books: [], categories: [] });
  const [isTranslating, setIsTranslating] = useState({ stories: false, books: false, categories: false });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState([]);

  // Filters for tabs
  const [filterAuthor, setFilterAuthor] = useState(null);
  const [filterCategory, setFilterCategory] = useState(null);
  const [filterBookNo, setFilterBookNo] = useState(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Sorting
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [expandedCategories, setExpandedCategories] = useState(new Set());

  const toggleCategory = (id) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const SUPABASE_TABLES = [
    { name: 'stories',           label: 'Hikayeler',         icon: '📖' },
    { name: 'profiles',          label: 'Kullanıcılar',      icon: '👤' },
    { name: 'push_tokens',       label: 'Push Token',        icon: '🔔' },
    { name: 'main_categories',   label: 'Ana Kategoriler',   icon: '🗂' },
    { name: 'sub_categories',    label: 'Alt Kategoriler',   icon: '📂' },
    { name: 'books',             label: 'Kitaplar',          icon: '📚' },
    { name: 'book_translations', label: 'Kitap Çevirileri',  icon: '🌐' },
    { name: 'story_translations',label: 'Hikaye Çevirileri', icon: '✍️' },
  ];

  useEffect(() => {
    fetchData();
    fetchSupabaseCounts();

    const handleScroll = () => {
      const scrollPx = document.documentElement.scrollTop;
      const winHeightPx = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = `${(scrollPx / winHeightPx) * 100}%`;
      setScrollProgress(scrolled);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const fetchSupabaseCounts = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/supabase-counts');
      if (res.ok) setSupaTableCounts(await res.json());
    } catch (e) { /* silent */ }
  };

  const openSupabaseTable = async (tableName, initialSearch = '') => {
    setActiveSection('supabase');
    setSupaTableActive(tableName);
    setSupaTableLoading(true);
    setSupaTableData([]);
    setSupaTableCols([]);
    setSupaStoriesDetail(null);
    setSupaStoriesSearch(initialSearch);
    try {
      // For stories table, fetch all rows (all langs)
      const limit = tableName === 'stories' ? 5000 : 500;
      const res = await fetch(`http://localhost:3001/api/supabase-table/${tableName}?limit=${limit}`);
      const json = await res.json();
      if (res.ok && Array.isArray(json.rows)) {
        setSupaTableData(json.rows);
        setSupaTableCols(json.rows.length > 0 ? Object.keys(json.rows[0]) : []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSupaTableLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    setCurrentPage(1); // Reset page on filter change
    setSearchQuery(''); // Reset search query on tab/filter change
  }, [activeTab, filterAuthor, filterCategory, filterBookNo, currentLang]);

  const fetchData = async () => {
    try {
      if (activeTab === 'kitap') {
        let url = `http://localhost:3001/api/books?lang=${currentLang}&`;
        if (filterAuthor) url += `author=${encodeURIComponent(filterAuthor)}&`;
        if (filterCategory) url += `category=${encodeURIComponent(filterCategory)}&`;
        const res = await fetch(url);
        setBooks(await res.json());
      } else if (activeTab === 'kategori') {
        const res = await fetch(`http://localhost:3001/api/categories?lang=${currentLang}`);
        setCategories(await res.json());
      } else if (activeTab === 'yazar') {
        const res = await fetch('http://localhost:3001/api/authors');
        setAuthors(await res.json());
      } else if (activeTab === 'hikaye') {
        let url = `http://localhost:3001/api/stories?lang=${currentLang}&`;
        if (filterBookNo) url += `book_no=${filterBookNo}&`;
        const res = await fetch(url);
        setStories(await res.json());
      } else if (activeTab === 'ceviri') {
        fetchTranslationStats();
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const fetchTranslationStats = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/translate-stats');
      setTranslationStats(await res.json());
    } catch (error) {
      console.error('Error fetching stats', error);
    }
  };

  const openStoryModal = async (item) => {
    setSelectedStory(item);
    setModalLang(currentLang);
    setSelectedStoryTranslations({});
    try {
      const res = await fetch(`http://localhost:3001/api/stories/${item.id}/translations`);
      const data = await res.json();
      setSelectedStoryTranslations(data);
    } catch (err) {
      console.error(err);
    }
  };

  const startTranslation = async (type, endpoint, limit, itemName) => {
    setIsTranslating(prev => ({ ...prev, [type]: true }));
    setTranslationLogs(prev => ({ ...prev, [type]: [...(prev[type] || []), 'Ücretsiz Google API Çeviri işlemi başlatıldı...'] }));

    let keepTranslating = true;
    while (keepTranslating) {
      try {
        const response = await fetch(`http://localhost:3001/api/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Çeviri başarısız');

        if (result.processed === 0) {
          keepTranslating = false;
          setTranslationLogs(prev => ({ ...prev, [type]: [...(prev[type] || []), `Tüm ${itemName} başarıyla çevrildi!`] }));
          await fetchTranslationStats();
        } else {
          setTranslationLogs(prev => ({ ...prev, [type]: [...(prev[type] || []), `Başarılı: ${result.processed} ${itemName} Google ile çevrildi...`] }));
          await fetchTranslationStats();
        }
      } catch (error) {
        keepTranslating = false;
        setTranslationLogs(prev => ({ ...prev, [type]: [...(prev[type] || []), `Hata: ${error.message}. İşlem durduruldu.`] }));
      }
    }
    setIsTranslating(prev => ({ ...prev, [type]: false }));
  };

  const renderTranslationSection = (title, type, endpoint, limit, itemName, note) => {
    const stats = translationStats[type] || { total: 0, translated: { tr: 0, en: 0, de: 0, es: 0 } };
    const logs = translationLogs[type] || [];
    const isBusy = isTranslating[type];

    return (
      <div style={{ flex: 1, minWidth: '300px' }}>
        <div style={{ background: 'var(--surface-low)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--outline-variant)', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--primary)', textAlign: 'center' }}>{title}</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {['tr', 'en', 'de', 'es'].map(lang => {
              const count = stats.translated[lang] || 0;
              const total = stats.total || 1;
              const percent = ((count / total) * 100).toFixed(0);
              return (
                <div key={lang} style={{ background: 'var(--surface-highest)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--outline-variant)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>{lang} Dili</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{count} <span style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)', fontWeight: 'normal' }}>/ {stats.total}</span></div>
                  <div style={{ width: '100%', height: '4px', background: 'var(--surface-low)', marginTop: '0.5rem', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: `${percent}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.5s' }}></div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
            <button
              className="button-primary"
              style={{ padding: '0.8rem', fontSize: '0.9rem' }}
              onClick={() => startTranslation(type, endpoint, limit, itemName)}
              disabled={isBusy}
            >
              <Sparkles size={16} />
              {isBusy ? 'İşleniyor...' : `Eksik ${title.split(' ')[0]} Çevir`}
            </button>
            <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', textAlign: 'center' }}>
              {note}
            </p>
          </div>

          {logs.length > 0 && (
            <div style={{ mt: 'auto', background: '#0a0a0a', border: '1px solid var(--outline-variant)', borderRadius: '8px', padding: '0.75rem', height: '120px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.75rem', color: '#00ffcc', marginTop: '1rem' }}>
              {logs.map((log, index) => (
                <div key={index} style={{ marginBottom: '0.25rem' }}>&gt; {log}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleSupabaseSync = async () => {
    setIsSyncing(true);
    setSyncLogs(['Supabase senkronizasyonu başlatıldı...']);
    try {
      const res = await fetch('http://localhost:3001/api/sync-supabase', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bilinmeyen bir hata oluştu');

      const newLogs = ['Senkronizasyon başarıyla tamamlandı!'];
      for (const [table, count] of Object.entries(data.results)) {
        newLogs.push(`> ${table}: ${count} kayıt başarıyla aktarıldı.`);
      }
      setSyncLogs(prev => [...prev, ...newLogs]);
    } catch (err) {
      setSyncLogs(prev => [...prev, `Hata: ${err.message}`]);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage({ text: 'Lütfen bir dosya seçin', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage({ text: '', type: '' });

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:3001/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      setMessage({ text: result.message, type: 'success' });
      setFile(null);

      fetchData();
    } catch (error) {
      setMessage({ text: error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleClearData = async () => {
    if (!window.confirm('Tüm veritabanı silinecek. Bu işlem geri alınamaz. Emin misiniz?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/clear', {
        method: 'POST',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Reset failed');

      setMessage({ text: result.message, type: 'success' });
      fetchData();
    } catch (error) {
      setMessage({ text: error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async (story) => {
    const shareData = {
      title: `Kıvılcım: ${story.title}`,
      text: `${story.description}\n\nKıvılcım uygulamasında bu hikayeyi keşfedin!`,
      url: `https://kivilcim.app/hikaye/${story.book_no}`
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Share failed:', err);
      }
    } else {
      // Fallback: Copy to clipboard
      navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
      setMessage({ text: 'Link panoya kopyalandı! (Dinamik hikaye kartı gerçek uygulamada oluşturulacaktır)', type: 'success' });
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    }
  };

  const downloadShareCard = async () => {
    if (!shareCardRef.current) return;

    setLoading(true);
    try {
      // Small delay to ensure any animations or fonts are loaded
      await new Promise(resolve => setTimeout(resolve, 500));

      const dataUrl = await toPng(shareCardRef.current, {
        cacheBust: true,
        backgroundColor: '#131311',
        style: {
          borderRadius: '24px',
          boxShadow: 'none'
        }
      });

      const link = document.createElement('a');
      link.download = `kivilcim-paylas-${sharePreviewStory.title.toLowerCase().replace(/\s+/g, '-')}.png`;
      link.href = dataUrl;
      link.click();

      setMessage({ text: 'Görsel başarıyla oluşturuldu!', type: 'success' });
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } catch (err) {
      console.error('Image generation failed:', err);
      setMessage({ text: 'Görsel oluşturulamadı.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const extractMainIdea = (content) => {
    if (!content) return null;
    const match = content.match(/\$\$([\s\S]*?)\$\$/);
    return match ? match[1].trim() : null;
  };

  const navigateToTab = (tab, filters = {}) => {
    setFilterAuthor(filters.author || null);
    setFilterCategory(filters.category || null);
    setFilterBookNo(filters.bookNo || null);
    setActiveTab(tab);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) return <ArrowUpDown size={14} style={{ opacity: 0.3, marginLeft: '0.5rem' }} />;
    return sortConfig.direction === 'asc'
      ? <ArrowUp size={14} style={{ color: 'var(--primary)', marginLeft: '0.5rem' }} />
      : <ArrowDown size={14} style={{ color: 'var(--primary)', marginLeft: '0.5rem' }} />;
  };

  const getCurrentDataList = () => {
    let list = [];
    if (activeTab === 'kitap') list = [...books];
    else if (activeTab === 'kategori') list = [...categories];
    else if (activeTab === 'yazar') list = [...authors];
    else if (activeTab === 'hikaye') list = [...stories];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      list = list.filter(item => {
        return Object.values(item).some(val =>
          val !== null && val !== undefined && val.toString().toLowerCase().includes(query)
        );
      });
    }

    if (sortConfig.key) {
      list.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        const isNum = !isNaN(parseFloat(valA)) && isFinite(valA) && !isNaN(parseFloat(valB)) && isFinite(valB);
        if (isNum) return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
        return sortConfig.direction === 'asc'
          ? valA.toString().localeCompare(valB.toString())
          : valB.toString().localeCompare(valA.toString());
      });
    }

    return list;
  };

  const renderStoryContent = (content) => {
    if (!content) return null;
    const regex = /(##[\s\S]*?##|\$\$[\s\S]*?\$\$|&&[\s\S]*?&&)/g;
    const parts = content.split(regex);
    return parts.map((part, index) => {
      if (part.startsWith('##') && part.endsWith('##')) {
        const text = part.slice(2, -2);
        return <div key={index} className="story-vurgu">{text}</div>;
      } else if (part.startsWith('$$') && part.endsWith('$$')) {
        const text = part.slice(2, -2);
        return (
          <div key={index} className="story-anafikir-container">
            <div className="story-anafikir-separator">
              <span className="story-anafikir-star">✦</span>
            </div>
            <div className="story-anafikir-header">ANA FİKİR</div>
            <div className="story-anafikir-box">{text}</div>
          </div>
        );
      } else if (part.startsWith('&&') && part.endsWith('&&')) {
        const text = part.slice(2, -2);
        return (
          <div key={index} className="story-reflection-card">
            <div className="story-reflection-header">
              <span>💭</span> DÜŞÜN VE SORGULA
            </div>
            <div className="story-reflection-text">{text}</div>
          </div>
        );
      } else {
        return part.split(/\n\s*\n/).map((paragraph, pIndex) => (
          paragraph.trim() && <span key={`${index}-${pIndex}`} className="story-paragraph">{paragraph.trim()}</span>
        ));
      }
    });
  };

  const dataList = getCurrentDataList();
  const totalPages = Math.ceil(dataList.length / itemsPerPage);
  const safeCurrentPage = Math.min(currentPage, Math.max(1, totalPages));
  const currentItems = dataList.slice((safeCurrentPage - 1) * itemsPerPage, safeCurrentPage * itemsPerPage);

  const renderPagination = () => {
    if (dataList.length === 0) return null;
    return (
      <div className="pagination-wrapper">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <label style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)' }}>Sayfa Başına Seçim:</label>
          <select className="input-field" style={{ padding: '0.3rem 0.5rem' }} value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
            <option value={10}>10</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button className="button-icon" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
            <ChevronLeft size={18} />
          </button>
          <span style={{ fontSize: '0.875rem', fontFamily: 'var(--font-functional)', color: 'var(--on-surface-variant)' }}>
            Sayfa {currentPage} / {totalPages || 1}
          </span>
          <button className="button-icon" disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => p + 1)}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="reading-progress-bar" style={{ width: scrollProgress }}></div>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '4rem 2rem' }}>
        <header style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ fontSize: '3.5rem', marginBottom: '1rem', letterSpacing: '-0.02em', color: 'var(--primary)' }}>Digital Curatorship</h1>
            <p style={{ fontSize: '1.25rem', color: 'var(--on-surface-variant)', fontFamily: 'var(--font-functional)' }}>Kıvılcım Uygulaması Yönetim Merkezi</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--surface-low)', padding: '0.4rem', borderRadius: '8px', border: '1px solid var(--outline-variant)' }}>
            {[{ code: 'tr', label: 'TR', name: 'Türkçe' }, { code: 'en', label: 'EN', name: 'English' }, { code: 'de', label: 'DE', name: 'Deutsch' }, { code: 'es', label: 'ES', name: 'Español' }].map(lang => (
              <button key={lang.code} onClick={() => setCurrentLang(lang.code)} style={{ background: currentLang === lang.code ? 'var(--primary-container)' : 'transparent', color: currentLang === lang.code ? 'var(--on-primary)' : 'var(--on-surface-variant)', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', fontFamily: 'var(--font-functional)', fontWeight: '600', fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.2s ease' }} title={lang.name}> {lang.label} </button>
            ))}
          </div>
        </header>

        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 3.5fr)', gap: '4rem', alignItems: 'start' }}>
          <div className="card glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <h2 style={{ fontSize: '1.5rem', borderBottom: '1px solid var(--outline-variant)', paddingBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}> <UploadCloud size={20} color="var(--primary)" /> Toplu Kataloğa Aktar </h2>
            <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.9rem', lineHeight: '1.5' }}> .xlsx dosyanızı yükleyin. Kitaplar, Kategoriler ve Hikayeler tabloları güncellenecektir. </p>
            <div className="input-group">
              <input id="excel-file" type="file" accept=".xlsx" onChange={handleFileChange} className="input-field" />
            </div>
            <button className="button-primary" onClick={handleUpload} disabled={loading} style={{ width: '100%' }}> {loading ? 'Yükleniyor...' : 'Kataloğa Aktar'} {!loading && <BookOpen size={16} />} </button>
            {message.text && (
              <div style={{ padding: '1rem', borderRadius: '8px', backgroundColor: message.type === 'error' ? 'rgba(231, 76, 60, 0.1)' : 'rgba(46, 204, 113, 0.1)', color: message.type === 'error' ? '#e74c3c' : '#2ecc71', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-functional)', fontSize: '0.875rem' }}> {message.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />} {message.text} </div>
            )}
            
            <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>

              {/* ── Supabase DB Section ── */}
              <button
                onClick={() => setSupabaseOpenSection(v => !v)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '0.6rem 0.5rem', borderRadius: '8px', color: 'var(--on-surface-variant)', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-functional)' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Cloud size={14} color="#7c6af7" /> Supabase DB</span>
                <ChevronDown size={14} style={{ transform: supabaseOpenSection ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
              </button>

              {supabaseOpenSection && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', paddingLeft: '0.75rem', marginBottom: '0.75rem' }}>
                  {SUPABASE_TABLES.map(t => (
                    <button
                      key={t.name}
                      className={`tab-button ${activeSection === 'supabase' && supaTableActive === t.name ? 'active' : ''}`}
                      style={{ fontSize: '0.82rem', padding: '0.45rem 0.75rem', justifyContent: 'space-between' }}
                      onClick={() => openSupabaseTable(t.name)}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.9rem' }}>{t.icon}</span>
                        {t.label}
                      </span>
                      {supaTableCounts[t.name] !== undefined && (
                        <span style={{ fontSize: '0.7rem', background: 'var(--surface-highest)', color: 'var(--on-surface-variant)', padding: '0.1rem 0.4rem', borderRadius: '10px', fontFamily: 'var(--font-functional)' }}>
                          {supaTableCounts[t.name].toLocaleString()}
                        </span>
                      )}
                    </button>
                  ))}
                  <button
                    className={`tab-button ${activeSection === 'supabase' && supaTableActive === '__sync' ? 'active' : ''}`}
                    style={{ fontSize: '0.82rem', padding: '0.45rem 0.75rem', marginTop: '0.25rem' }}
                    onClick={() => { setActiveSection('supabase'); setSupaTableActive('__sync'); }}
                  >
                    <RefreshCw size={14} /> Supabase Eşitle
                  </button>
                </div>
              )}

              {/* ── Local DB Section ── */}
              <button
                onClick={() => setLocalDbOpenSection(v => !v)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '0.6rem 0.5rem', borderRadius: '8px', color: 'var(--on-surface-variant)', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-functional)' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><HardDrive size={14} color="#f7a36a" /> Local DB</span>
                <ChevronDown size={14} style={{ transform: localDbOpenSection ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
              </button>

              {localDbOpenSection && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', paddingLeft: '0.75rem', marginBottom: '0.75rem' }}>
                  <button className={`tab-button ${activeSection === 'localdb' && activeTab === 'kitap' ? 'active' : ''}`} style={{ fontSize: '0.82rem', padding: '0.45rem 0.75rem' }} onClick={() => { setActiveSection('localdb'); navigateToTab('kitap'); }}><BookOpen size={15} /> Kitaplar</button>
                  <button className={`tab-button ${activeSection === 'localdb' && activeTab === 'kategori' ? 'active' : ''}`} style={{ fontSize: '0.82rem', padding: '0.45rem 0.75rem' }} onClick={() => { setActiveSection('localdb'); navigateToTab('kategori'); }}><Layers size={15} /> Kategoriler</button>
                  <button className={`tab-button ${activeSection === 'localdb' && activeTab === 'yazar' ? 'active' : ''}`} style={{ fontSize: '0.82rem', padding: '0.45rem 0.75rem' }} onClick={() => { setActiveSection('localdb'); navigateToTab('yazar'); }}><Users size={15} /> Yazarlar</button>
                  <button className={`tab-button ${activeSection === 'localdb' && activeTab === 'hikaye' ? 'active' : ''}`} style={{ fontSize: '0.82rem', padding: '0.45rem 0.75rem' }} onClick={() => { setActiveSection('localdb'); navigateToTab('hikaye'); }}><FileText size={15} /> Hikayeler</button>
                  <button className={`tab-button ${activeSection === 'localdb' && activeTab === 'ceviri' ? 'active' : ''}`} style={{ fontSize: '0.82rem', padding: '0.45rem 0.75rem' }} onClick={() => { setActiveSection('localdb'); navigateToTab('ceviri'); }}><Sparkles size={15} /> Çeviri İşlemleri</button>
                </div>
              )}

              <div style={{ marginTop: 'auto', paddingTop: '1.5rem', borderTop: '1px solid var(--outline-variant)' }}>
                <button className="button-danger" onClick={handleClearData} disabled={loading} style={{ width: '100%', fontSize: '0.8rem' }}> <Trash2 size={16} /> Kataloğu Sıfırla </button>
              </div>
            </div>
          </div>

          <div className="card-highest" style={{ padding: '0', backgroundColor: 'var(--surface-lowest)' }}>
            <div style={{ padding: '2rem 3rem', borderBottom: '1px solid var(--outline-variant)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '1rem', textTransform: 'capitalize', margin: 0 }}>
                  {activeSection === 'supabase' && supaTableActive && supaTableActive !== '__sync' ? (
                    <><Cloud size={24} color="#7c6af7" /> {SUPABASE_TABLES.find(t => t.name === supaTableActive)?.label || supaTableActive} <span style={{ fontSize: '1rem', color: 'var(--on-surface-variant)', fontFamily: 'var(--font-functional)', fontWeight: '500' }}>{supaTableData.length} Kayıt</span></>
                  ) : activeSection === 'supabase' && supaTableActive === '__sync' ? (
                    <><RefreshCw size={24} color="#7c6af7" /> Supabase Eşitleme</>
                  ) : activeTab === 'kitap' ? 'Kitaplar' : activeTab === 'kategori' ? 'Kategoriler' : activeTab === 'yazar' ? 'Yazarlar' : activeTab === 'ceviri' ? 'AI Çeviri İşlemleri' : 'Hikayeler'}
                  {activeSection === 'localdb' && activeTab !== 'ceviri' && <span style={{ fontSize: '1rem', color: 'var(--on-surface-variant)', fontFamily: 'var(--font-functional)', fontWeight: '500' }}> {activeTab === 'kategori' ? categories.length : dataList.length} Toplam Kayıt </span>}
                </h2>
                {activeSection === 'localdb' && activeTab !== 'ceviri' && activeTab !== 'kategori' && (
                  <div className="input-group" style={{ flexDirection: 'row', alignItems: 'center', background: 'var(--surface-low)', borderRadius: '8px', padding: '0.2rem 1rem', border: '1px solid var(--outline-variant)' }}>
                    <Search size={18} color="var(--on-surface-variant)" />
                    <input type="text" placeholder="Tüm alanlarda ara..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} style={{ background: 'transparent', border: 'none', color: 'var(--on-surface)', padding: '0.5rem', outline: 'none', fontFamily: 'var(--font-functional)', minWidth: '250px' }} />
                  </div>
                )}
              </div>
              {(filterAuthor || filterCategory || filterBookNo) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: '4px', padding: '0.2rem 0.5rem' }}> Filtre: {filterAuthor || filterCategory || `Kitap No: ${filterBookNo}`} </span>
                  <button className="button-tertiary" onClick={() => navigateToTab(activeTab)} style={{ fontSize: '0.8rem', padding: '0' }}> Filtreyi Temizle </button>
                </div>
              )}
            </div>

            <div className="table-container">
              {activeSection === 'supabase' ? (
                supaTableActive === '__sync' ? (
                  <div style={{ padding: '2rem 3rem' }}>
                    <div style={{ background: 'var(--surface-low)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--outline-variant)' }}>
                      <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--primary)' }}>Supabase Veritabanı Senkronizasyonu</h3>
                      <p style={{ color: 'var(--on-surface-variant)', marginBottom: '2rem', lineHeight: '1.6' }}>
                        Bu işlem, yerel SQLite veritabanındaki tüm güncel verileri Supabase sunucusuna aktarır.
                        Sadece farklı veya yeni olan veriler Supabase üzerinde güncellenir.
                      </p>
                      <button
                        className="button-primary"
                        onClick={handleSupabaseSync}
                        disabled={isSyncing}
                        style={{ padding: '1rem 2rem', fontSize: '1.1rem', width: '100%', maxWidth: '300px' }}
                      >
                        <Database size={20} style={{ marginRight: '0.5rem' }} />
                        {isSyncing ? 'Senkronize Ediliyor...' : 'Verileri Eşitle (Sync)'}
                      </button>
                      {syncLogs.length > 0 && (
                        <div style={{ background: '#0a0a0a', border: '1px solid var(--outline-variant)', borderRadius: '8px', padding: '1rem', height: '250px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.875rem', color: '#00ffcc', marginTop: '2rem' }}>
                          {syncLogs.map((log, index) => (
                            <div key={index} style={{ marginBottom: '0.5rem' }}>{log.startsWith('>') ? log : `> ${log}`}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : supaTableActive === 'stories' ? (
                  // ── Supabase Stories: Custom List + Detail ─────────────────
                  <div style={{ display: 'flex', height: '100%', minHeight: '600px' }}>
                    {/* LEFT: List */}
                    <div style={{ flex: supaStoriesDetail ? '0 0 420px' : '1', borderRight: supaStoriesDetail ? '1px solid var(--outline-variant)' : 'none', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'flex 0.3s' }}>
                      {/* Lang filter + search */}
                      <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--outline-variant)', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', background: 'var(--surface-low)' }}>
                        <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--surface-highest)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--outline-variant)' }}>
                          {['tr','en','de','es'].map(l => (
                            <button key={l} onClick={() => { setSupaStoriesLang(l); setSupaStoriesDetail(null); }}
                              style={{ padding: '0.3rem 0.7rem', borderRadius: '5px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '0.75rem', fontFamily: 'var(--font-functional)', background: supaStoriesLang === l ? 'var(--primary-container)' : 'transparent', color: supaStoriesLang === l ? 'var(--on-primary)' : 'var(--on-surface-variant)', transition: 'all 0.15s' }}>
                              {l.toUpperCase()}
                            </button>
                          ))}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--surface-low)', border: '1px solid var(--outline-variant)', borderRadius: '8px', padding: '0.25rem 0.75rem', flex: 1 }}>
                          <Search size={14} color="var(--on-surface-variant)" />
                          <input type="text" placeholder="Başlık, yazar, kitap ara..." value={supaStoriesSearch} onChange={e => setSupaStoriesSearch(e.target.value)}
                            style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--on-surface)', fontFamily: 'var(--font-functional)', fontSize: '0.85rem', width: '100%' }} />
                          {supaStoriesSearch && <button onClick={() => setSupaStoriesSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)', lineHeight: 1 }}><X size={14} /></button>}
                        </div>
                      </div>
                      {/* Stories list */}
                      {supaTableLoading ? (
                        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--on-surface-variant)' }}>Yükleniyor...</div>
                      ) : (() => {
                        const filtered = supaTableData
                          .filter(r => r.lang === supaStoriesLang)
                          .filter(r => !supaStoriesSearch || [r.title, r.author, r.source_book, r.category_name, r.parent_cat].some(v => v && v.toLowerCase().includes(supaStoriesSearch.toLowerCase())));
                        return filtered.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--on-surface-variant)' }}>Kayıt bulunamadı.</div>
                        ) : (
                          <div style={{ overflowY: 'auto', flex: 1 }}>
                            <table className="admin-table" style={{ tableLayout: 'fixed' }}>
                              <thead>
                                <tr>
                                  <th style={{ width: '50px' }}>ID</th>
                                  <th>Başlık</th>
                                  <th style={{ width: '130px' }}>Yazar</th>
                                  <th style={{ width: '100px' }}>Kategori</th>
                                  <th style={{ width: '50px' }}>Yıl</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filtered.map((row) => (
                                  <tr key={row.id}
                                    onClick={() => { setSupaStoriesDetail(row.story_id); setSupaStoriesDetailLang(supaStoriesLang); }}
                                    style={{ cursor: 'pointer', background: supaStoriesDetail === row.story_id ? 'rgba(124,106,247,0.12)' : undefined, transition: 'background 0.15s' }}
                                    onMouseEnter={e => { if (supaStoriesDetail !== row.story_id) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                                    onMouseLeave={e => { if (supaStoriesDetail !== row.story_id) e.currentTarget.style.background = ''; }}
                                  >
                                    <td style={{ color: 'var(--primary)', fontWeight: '600', fontSize: '0.8rem' }}>{row.story_id}</td>
                                    <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 0, fontSize: '0.88rem' }} title={row.title}>{row.title}</td>
                                    <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 0, fontSize: '0.8rem', color: 'var(--on-surface-variant)' }} title={row.author}>{row.author}</td>
                                    <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 0, fontSize: '0.75rem', color: 'var(--on-surface-variant)' }} title={row.category_name}>{row.category_name}</td>
                                    <td style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>{row.publish_year}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <div style={{ padding: '0.75rem 1.5rem', color: 'var(--on-surface-variant)', fontSize: '0.8rem', borderTop: '1px solid var(--outline-variant)' }}>
                              {filtered.length} kayıt · {supaStoriesLang.toUpperCase()} dili
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* RIGHT: Detail */}
                    {supaStoriesDetail && (() => {
                      const allLangs = ['tr','en','de','es'];
                      const detailRow = supaTableData.find(r => r.story_id === supaStoriesDetail && r.lang === supaStoriesDetailLang)
                        || supaTableData.find(r => r.story_id === supaStoriesDetail);
                      if (!detailRow) return null;
                      const renderContent = (content) => {
                        if (!content) return <span style={{ color: 'var(--on-surface-variant)' }}>—</span>;
                        const regex = /(##[\s\S]*?##|\$\$[\s\S]*?\$\$|&&[\s\S]*?&&)/g;
                        const parts = content.split(regex);
                        return parts.map((part, i) => {
                          if (part.startsWith('##') && part.endsWith('##')) return <div key={i} className="story-vurgu">{part.slice(2,-2)}</div>;
                          if (part.startsWith('$$') && part.endsWith('$$')) return <div key={i} className="story-anafikir-box" style={{ margin: '1rem 0', padding: '1rem', background: 'var(--surface-high)', borderRadius: '8px', borderLeft: '3px solid var(--primary)' }}>{part.slice(2,-2)}</div>;
                          if (part.startsWith('&&') && part.endsWith('&&')) return <div key={i} className="story-reflection-card" style={{ margin: '1rem 0' }}><div className="story-reflection-header"><span>💭</span> DÜŞÜN</div><div className="story-reflection-text">{part.slice(2,-2)}</div></div>;
                          return part.split(/\n\n+/).map((p, j) => p.trim() && <p key={`${i}-${j}`} style={{ margin: '0.75rem 0', lineHeight: '1.7' }}>{p.trim()}</p>);
                        });
                      };

                      const convFields = [
                        { key: 'conv_punchline',    label: '⚡ Punchline',       desc: 'Tek cümlelik güçlü mesaj' },
                        { key: 'conv_thirty_sec',   label: '⏱ 30 Saniye Özet',  desc: 'Kısa sözlü anlatım' },
                        { key: 'conv_question',     label: '❓ Sohbet Sorusu',   desc: 'Tartışma başlatmak için' },
                        { key: 'conv_key_contrast', label: '🔄 Anahtar Karşıtlık', desc: 'Ana fikri vurgulayan zıtlık' },
                      ];

                      const CopyBtn = ({ text }) => (
                        <button
                          onClick={() => { navigator.clipboard.writeText(text || ''); }}
                          title="Kopyala"
                          style={{ background: 'var(--surface-highest)', border: '1px solid var(--outline-variant)', borderRadius: '6px', padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: '0.7rem', color: 'var(--on-surface-variant)', display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}
                        >
                          📋
                        </button>
                      );

                      return (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                          {/* Detail header: lang tabs + content tabs + close */}
                          <div style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--outline-variant)', background: 'var(--surface-low)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                            {/* Left: lang pills */}
                            <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--surface-highest)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--outline-variant)' }}>
                              {allLangs.map(l => {
                                const exists = supaTableData.some(r => r.story_id === supaStoriesDetail && r.lang === l);
                                return (
                                  <button key={l} onClick={() => setSupaStoriesDetailLang(l)} disabled={!exists}
                                    style={{ padding: '0.3rem 0.7rem', borderRadius: '5px', border: 'none', cursor: exists ? 'pointer' : 'not-allowed', fontWeight: '700', fontSize: '0.75rem', fontFamily: 'var(--font-functional)', background: supaStoriesDetailLang === l ? 'var(--primary-container)' : 'transparent', color: supaStoriesDetailLang === l ? 'var(--on-primary)' : exists ? 'var(--on-surface-variant)' : 'var(--outline-variant)', opacity: exists ? 1 : 0.4, transition: 'all 0.15s' }}>
                                    {l.toUpperCase()}
                                  </button>
                                );
                              })}
                            </div>
                            {/* Middle: content type tabs */}
                            <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--surface-highest)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--outline-variant)' }}>
                              {[{id:'icerik', label:'📖 İçerik'}, {id:'sohbet', label:'💬 Sohbette Kullan'}].map(tab => (
                                <button key={tab.id} onClick={() => setSupaStoriesDetailTab(tab.id)}
                                  style={{ padding: '0.3rem 0.8rem', borderRadius: '5px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.75rem', fontFamily: 'var(--font-functional)', whiteSpace: 'nowrap', background: supaStoriesDetailTab === tab.id ? 'var(--primary-container)' : 'transparent', color: supaStoriesDetailTab === tab.id ? 'var(--on-primary)' : 'var(--on-surface-variant)', transition: 'all 0.15s' }}>
                                  {tab.label}
                                </button>
                              ))}
                            </div>
                            <button onClick={() => setSupaStoriesDetail(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)', display: 'flex', alignItems: 'center' }}><X size={18} /></button>
                          </div>

                          {/* Detail body */}
                          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem' }}>
                            {/* Common header (always shown) */}
                            <div style={{ fontSize: '0.75rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem', fontFamily: 'var(--font-functional)' }}>
                              #{detailRow.story_id} · {detailRow.author} · {detailRow.publish_year}
                            </div>
                            <h2 style={{ fontSize: '1.5rem', lineHeight: '1.3', marginBottom: '0.75rem' }}>{detailRow.title}</h2>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                              {detailRow.parent_cat && <span style={{ fontSize: '0.72rem', background: 'var(--surface-high)', border: '1px solid var(--outline-variant)', borderRadius: '20px', padding: '0.2rem 0.6rem', color: 'var(--on-surface-variant)' }}>{detailRow.parent_cat}</span>}
                              {detailRow.category_name && <span style={{ fontSize: '0.72rem', background: 'var(--primary-container)', borderRadius: '20px', padding: '0.2rem 0.6rem', color: 'var(--on-primary)' }}>{detailRow.category_name}</span>}
                              {detailRow.source_book && <span style={{ fontSize: '0.72rem', background: 'var(--surface-high)', border: '1px solid var(--outline-variant)', borderRadius: '20px', padding: '0.2rem 0.6rem', color: 'var(--on-surface-variant)' }}>📚 {detailRow.source_book}</span>}
                              {detailRow.is_premium && <span style={{ fontSize: '0.72rem', background: '#7c6af722', border: '1px solid #7c6af7', borderRadius: '20px', padding: '0.2rem 0.6rem', color: '#7c6af7' }}>Premium</span>}
                            </div>

                            {/* TAB: İçerik */}
                            {supaStoriesDetailTab === 'icerik' && (
                              <>
                                {detailRow.description && <p style={{ fontSize: '1rem', color: 'var(--on-surface-variant)', fontStyle: 'italic', borderLeft: '2px solid var(--primary)', paddingLeft: '1rem', marginBottom: '1.5rem', lineHeight: '1.6' }}>{detailRow.description}</p>}
                                {detailRow.hook && <div style={{ background: 'var(--surface-high)', border: '1px solid var(--outline-variant)', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1.5rem', fontSize: '0.9rem', color: 'var(--on-surface-variant)', fontStyle: 'italic' }}>🪝 {detailRow.hook}</div>}
                                <div style={{ fontSize: '0.95rem', lineHeight: '1.75', color: 'var(--on-surface)' }}>{renderContent(detailRow.content)}</div>
                              </>
                            )}

                            {/* TAB: Sohbette Kullan */}
                            {supaStoriesDetailTab === 'sohbet' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {convFields.map(({ key, label, desc }) => (
                                  <div key={key} style={{ background: 'var(--surface-low)', border: '1px solid var(--outline-variant)', borderRadius: '10px', overflow: 'hidden' }}>
                                    <div style={{ padding: '0.6rem 1rem', background: 'var(--surface-high)', borderBottom: '1px solid var(--outline-variant)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                                      <div>
                                        <span style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--on-surface)' }}>{label}</span>
                                        <span style={{ fontSize: '0.72rem', color: 'var(--on-surface-variant)', marginLeft: '0.5rem' }}>{desc}</span>
                                      </div>
                                      {detailRow[key] && <CopyBtn text={detailRow[key]} />}
                                    </div>
                                    <div style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', lineHeight: '1.6', color: detailRow[key] ? 'var(--on-surface)' : 'var(--on-surface-variant)', fontStyle: detailRow[key] ? 'normal' : 'italic', minHeight: '2.5rem' }}>
                                      {detailRow[key] || '— Bu alan henüz doldurulmamış'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : supaTableActive ? (
                  <div style={{ padding: '1rem' }}>
                    {supaTableLoading ? (
                      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--on-surface-variant)' }}>Yükleniyor...</div>
                    ) : supaTableData.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--on-surface-variant)' }}>Bu tablo boş.</div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table className="admin-table">
                          <thead>
                            <tr>
                              {supaTableCols.map(col => (
                                <th key={col} style={{ whiteSpace: 'nowrap', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {supaTableData.slice(0, 100).map((row, idx) => {
                              // Link to stories table if it's a book or category
                              const isNavigable = ['books', 'book_translations', 'main_categories', 'sub_categories', 'sub_category_translations'].includes(supaTableActive);
                              const handleRowClick = () => {
                                if (!isNavigable) return;
                                let search = '';
                                if (supaTableActive === 'books') search = row.author || '';
                                if (supaTableActive === 'book_translations') search = row.title || '';
                                if (supaTableActive === 'main_categories') search = row.name_tr || row.name_en || '';
                                if (supaTableActive === 'sub_categories') search = row.category_name || '';
                                if (supaTableActive === 'sub_category_translations') search = row.translation || '';
                                if (search) {
                                  openSupabaseTable('stories', search);
                                }
                              };
                              return (
                                <tr key={idx} 
                                  onClick={handleRowClick}
                                  style={{ cursor: isNavigable ? 'pointer' : 'default', transition: 'background 0.15s' }}
                                  onMouseEnter={e => { if (isNavigable) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                                  onMouseLeave={e => { if (isNavigable) e.currentTarget.style.background = ''; }}
                                >
                                  {supaTableCols.map(col => (
                                    <td key={col} style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.82rem' }} title={String(row[col] ?? '')}>
                                      {row[col] === null ? <span style={{ color: 'var(--on-surface-variant)', fontStyle: 'italic' }}>null</span> : String(row[col]).length > 80 ? String(row[col]).slice(0, 80) + '…' : String(row[col])}
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {supaTableData.length > 100 && (
                          <div style={{ padding: '1rem 2rem', color: 'var(--on-surface-variant)', fontSize: '0.85rem' }}>
                            İlk 100 satır gösteriliyor. Toplam: {supaTableData.length}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--on-surface-variant)' }}>Sol menüden bir tablo seçin.</div>
                )
              ) : activeTab === 'ceviri' ? (
                <div style={{ padding: '2rem 3rem' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'stretch' }}>
                    {renderTranslationSection('Kitap Çevirisi', 'books', 'translate-books-batch', 20, 'kitap', "Kitap isimleri kısa olduğu için 20'şerli çevrilir.")}
                    {renderTranslationSection('Kategori Çevirisi', 'categories', 'translate-categories-batch', 20, 'kategori', "Kategoriler kısa olduğu için 20'şerli çevrilir.")}
                    {renderTranslationSection('Hikaye Çevirisi', 'stories', 'translate-batch', 5, 'hikaye', "Hikaye metinleri uzun olduğu için 5'erli çevrilir.")}
                  </div>
                </div>
              ) : activeTab === 'kategori' ? (
                <div style={{ padding: '2rem 3rem' }}>
                  {categories.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--on-surface-variant)' }}>Kategori verisi yok.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {categories.map((cat) => {
                        const isExpanded = expandedCategories.has(cat.id);
                        return (
                          <div key={cat.id} style={{ border: '1px solid var(--outline-variant)', borderRadius: '12px', overflow: 'hidden', background: 'var(--surface-low)', transition: 'box-shadow 0.2s' }}>
                            {/* Category Row */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', alignItems: 'center', gap: '1.5rem', padding: '1rem 1.5rem', background: 'var(--surface-high)' }}>
                              <span style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--on-surface)' }}>
                                {cat.name}
                              </span>
                              <span style={{ background: 'var(--surface-highest)', color: 'var(--on-surface-variant)', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', fontFamily: 'var(--font-functional)', border: '1px solid var(--outline-variant)', whiteSpace: 'nowrap' }}>
                                📚 {cat.book_count} Kitap
                              </span>
                              <button
                                onClick={() => toggleCategory(cat.id)}
                                title={isExpanded ? 'Alt kategorileri gizle' : 'Alt kategorileri göster'}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: isExpanded ? 'var(--primary-container)' : 'var(--surface-highest)', color: isExpanded ? 'var(--on-primary)' : 'var(--on-surface-variant)', border: '1px solid var(--outline-variant)', borderRadius: '20px', padding: '0.25rem 0.75rem', fontSize: '0.8rem', fontFamily: 'var(--font-functional)', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
                              >
                                🗂 {cat.sub_count} Alt Kategori
                                <span style={{ marginLeft: '0.25rem', display: 'inline-block', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s' }}>▾</span>
                              </button>
                            </div>

                            {/* Subcategory List (collapsible) */}
                            {isExpanded && (
                              <div style={{ borderTop: '1px solid var(--outline-variant)' }}>
                                {cat.sub_categories.length === 0 ? (
                                  <div style={{ padding: '1rem 1.5rem', color: 'var(--on-surface-variant)', fontSize: '0.875rem' }}>Alt kategori bulunamadı.</div>
                                ) : cat.sub_categories.map((sub) => (
                                  <div key={sub.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: '1rem', padding: '0.65rem 2rem', borderBottom: '1px solid var(--outline-variant)', transition: 'background 0.15s' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                  >
                                    <span style={{ fontSize: '0.95rem', color: 'var(--on-surface)', paddingLeft: '0.5rem', borderLeft: '2px solid var(--outline-variant)' }}>
                                      {sub.name}
                                    </span>
                                    <span style={{ color: 'var(--on-surface-variant)', fontSize: '0.8rem', fontFamily: 'var(--font-functional)', whiteSpace: 'nowrap' }}>
                                      {sub.book_count} kitap
                                    </span>
                                    <a href="#" className="table-link" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                                      onClick={(e) => { e.preventDefault(); navigateToTab('kitap', { category: sub.name }); }}
                                    >
                                      Kitapları Gör →
                                    </a>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <table className="admin-table">
                    <thead>
                      {activeTab === 'kitap' && (
                        <tr>
                          <th style={{ cursor: 'pointer' }} onClick={() => handleSort('list_no')}>No {renderSortIcon('list_no')}</th>
                          <th style={{ cursor: 'pointer' }} onClick={() => handleSort('title')}>Adı {renderSortIcon('title')}</th>
                          <th style={{ cursor: 'pointer' }} onClick={() => handleSort('author')}>Yazar {renderSortIcon('author')}</th>
                          <th style={{ cursor: 'pointer' }} onClick={() => handleSort('category')}>Kategori {renderSortIcon('category')}</th>
                          <th style={{ cursor: 'pointer' }} onClick={() => handleSort('story_count')}>Hikaye Sayısı {renderSortIcon('story_count')}</th>
                          <th style={{ cursor: 'pointer' }} onClick={() => handleSort('publish_year')}>Yıl {renderSortIcon('publish_year')}</th>
                        </tr>
                      )}
                      {activeTab === 'yazar' && (
                        <tr>
                          <th style={{ cursor: 'pointer' }} onClick={() => handleSort('author')}>Yazar Adı {renderSortIcon('author')}</th>
                          <th style={{ cursor: 'pointer' }} onClick={() => handleSort('book_count')}>Kayıtlı Kitap Sayısı {renderSortIcon('book_count')}</th>
                          <th>İşlem</th>
                        </tr>
                      )}
                      {activeTab === 'hikaye' && (
                        <tr>
                          <th style={{ cursor: 'pointer' }} onClick={() => handleSort('id')}>ID {renderSortIcon('id')}</th>
                          <th style={{ cursor: 'pointer' }} onClick={() => handleSort('book_no')}>Eser No {renderSortIcon('book_no')}</th>
                          <th style={{ cursor: 'pointer' }} onClick={() => handleSort('book_title')}>Kitap Adı {renderSortIcon('book_title')}</th>
                          <th style={{ cursor: 'pointer' }} onClick={() => handleSort('title')}>Hikaye Başlığı {renderSortIcon('title')}</th>
                          <th>Açıklama Özeti</th>
                          <th style={{ textAlign: 'center' }}>Aksiyon</th>
                        </tr>
                      )}
                    </thead>
                    <tbody>
                      {currentItems.length === 0 ? (
                        <tr><td colSpan="6" style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--on-surface-variant)' }}>Bu liste boş. Lütfen verileri güncelleyin veya filtreleri kaldırın.</td></tr>
                      ) : currentItems.map((item, idx) => (
                        <React.Fragment key={idx}>
                          {activeTab === 'kitap' && (
                            <tr>
                              <td style={{ color: 'var(--primary)', fontWeight: '500' }}>{item.list_no}</td>
                              <td style={{ fontSize: '1.1rem' }}><a href="#" className="table-link" onClick={(e) => { e.preventDefault(); navigateToTab('hikaye', { bookNo: item.list_no }); }}>{item.title}</a></td>
                              <td><a href="#" className="table-link" onClick={(e) => { e.preventDefault(); navigateToTab('kitap', { author: item.author }); }}>{item.author}</a></td>
                              <td>
                                <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginBottom: '0.2rem' }}>{item.main_category}</div>
                                <a href="#" className="table-link" onClick={(e) => { e.preventDefault(); navigateToTab('kitap', { category: item.category }); }}>{item.category}</a>
                              </td>
                              <td style={{ textAlign: 'center' }}><span style={{ background: 'var(--surface-high)', color: 'var(--primary)', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '600', fontFamily: 'var(--font-functional)', border: '1px solid var(--outline-variant)' }}>{item.story_count}</span></td>
                              <td style={{ fontSize: '0.875rem' }}>{item.publish_year}</td>
                            </tr>
                          )}
                          {activeTab === 'yazar' && (
                            <tr>
                              <td style={{ fontSize: '1.1rem' }}>{item.author}</td>
                              <td style={{ color: 'var(--on-surface-variant)' }}>{item.book_count} Kitap</td>
                              <td><a href="#" className="table-link" onClick={(e) => { e.preventDefault(); navigateToTab('kitap', { author: item.author }); }}>Yazarın Kitaplarını Gör →</a></td>
                            </tr>
                          )}
                          {activeTab === 'hikaye' && (
                            <tr>
                              <td style={{ fontWeight: '600', color: 'var(--on-surface-variant)' }}>#{item.id}</td>
                              <td style={{ color: 'var(--primary)', fontWeight: '500' }}>{item.book_no}</td>
                              <td><a href="#" className="table-link" onClick={(e) => { e.preventDefault(); navigateToTab('kitap', { bookNo: item.book_no }); }}>{item.book_title}</a></td>
                              <td style={{ fontSize: '1.1rem' }}><a href="#" className="table-link" onClick={(e) => { e.preventDefault(); openStoryModal(item); }} style={{ color: 'var(--on-surface)' }}>{item.title}</a></td>
                              <td style={{ color: 'var(--on-surface-variant)', fontSize: '0.875rem', maxWidth: '350px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.description}</td>
                              <td style={{ textAlign: 'center' }}>
                                <button className="button-tertiary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: 'var(--surface-high)', borderRadius: '4px' }} onClick={() => setSharePreviewStory(item)}>
                                  <Share2 size={14} /> Ön İzle
                                </button>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ padding: '1rem 2rem', borderTop: '1px solid var(--outline-variant)' }}> {renderPagination()} </div>
                </>
              )}
            </div>
          </div>
        </section>
      </div>

      {selectedStory && (
        <div className="modal-overlay" onClick={() => setSelectedStory(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ position: 'absolute', top: '1.5rem', right: '4rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '0.2rem', background: 'var(--surface-low)', padding: '0.2rem', borderRadius: '8px', border: '1px solid var(--outline-variant)', marginRight: '1rem' }}>
                {[{ code: 'tr', label: 'TR', name: 'Türkçe' }, { code: 'en', label: 'EN', name: 'English' }, { code: 'de', label: 'DE', name: 'Deutsch' }, { code: 'es', label: 'ES', name: 'Español' }].map(lang => (
                  <button key={lang.code} onClick={() => setModalLang(lang.code)} style={{ background: modalLang === lang.code ? 'var(--primary-container)' : 'transparent', color: modalLang === lang.code ? 'var(--on-primary)' : 'var(--on-surface-variant)', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px', fontFamily: 'var(--font-functional)', fontWeight: '600', fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.2s ease' }} title={lang.name}> {lang.label} </button>
                ))}
              </div>
              <button className="button-primary" style={{ padding: '0.5rem 1rem' }} onClick={() => handleShare(selectedStory)}>
                <Share2 size={16} /> Paylaş
              </button>
              <button className="modal-close" style={{ position: 'static' }} onClick={() => setSelectedStory(null)}> <X size={24} /> </button>
            </div>
            <div style={{ marginBottom: '2rem' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-functional)', fontWeight: '500', display: 'block', marginBottom: '0.5rem' }}> Hikaye Kodu: {selectedStory.book_no} </span>
              <h2 style={{ fontSize: '3rem', lineHeight: '1.2', marginBottom: '1rem' }}>{selectedStoryTranslations[modalLang]?.title || selectedStory.title}</h2>
              <p style={{ fontSize: '1.25rem', color: 'var(--on-surface-variant)', fontStyle: 'italic', borderLeft: '2px solid var(--primary)', paddingLeft: '1rem' }}> {selectedStoryTranslations[modalLang]?.description || selectedStory.description} </p>
            </div>
            <div style={{ fontSize: '1.125rem', lineHeight: '1.8', color: 'var(--on-surface)' }}> {renderStoryContent(selectedStoryTranslations[modalLang]?.content || selectedStory.content)} </div>
          </div>
        </div>
      )}

      {sharePreviewStory && (
        <div className="modal-overlay" onClick={() => setSharePreviewStory(null)}>
          <div className="modal-content" style={{ maxWidth: '500px', padding: '0', background: 'transparent', border: 'none', boxShadow: 'none' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" style={{ top: '-3rem', right: '0', color: '#fff' }} onClick={() => setSharePreviewStory(null)}> <X size={32} /> </button>

            <div className="share-card-container">
              <div className="share-card-artistic" ref={shareCardRef}>
                <div className="share-card-header">
                  <div className="share-card-logo">KIVILCIM</div>
                  <div className="share-card-id">#{sharePreviewStory.book_no}</div>
                </div>

                <div className="share-card-body">
                  <h3 className="share-card-title">{sharePreviewStory.title}</h3>
                  <div className="share-card-divider"></div>
                  <p className="share-card-quote">
                    {extractMainIdea(sharePreviewStory.content) || sharePreviewStory.description}
                  </p>
                </div>

                <div className="share-card-footer">
                  <div className="share-card-book-info">
                    <span className="share-card-book-title">{sharePreviewStory.book_title}</span>
                  </div>
                  <div className="share-card-qr-placeholder">
                    <div className="qr-inner">
                      <Sparkles size={24} color="#e67e22" />
                    </div>
                  </div>
                </div>

                <div className="share-card-decoration">
                  <div className="deco-spark">✦</div>
                </div>
              </div>

              <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button className="button-primary" onClick={downloadShareCard} disabled={loading}>
                  <DownloadCloud size={18} /> {loading ? 'Oluşturuluyor...' : 'Görsel Olarak İndir'}
                </button>
                <button className="button-tertiary" style={{ color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px' }} onClick={() => setSharePreviewStory(null)}>
                  Geri Dön
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;

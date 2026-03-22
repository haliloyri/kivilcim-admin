import React, { useState, useEffect } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, BookOpen, Layers, Users, FileText, ChevronLeft, ChevronRight, Search, X, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Share2, DownloadCloud, Sparkles } from 'lucide-react';
import { toPng } from 'html-to-image';
import './index.css';

function App() {
  const [activeTab, setActiveTab] = useState('kitap'); // kitap, yazar, kategori, hikaye
  const [selectedStory, setSelectedStory] = useState(null);
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

  useEffect(() => {
    fetchData();

    const handleScroll = () => {
      const scrollPx = document.documentElement.scrollTop;
      const winHeightPx = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = `${(scrollPx / winHeightPx) * 100}%`;
      setScrollProgress(scrolled);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
      }
    } catch (error) {
      console.error('Error fetching data:', error);
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
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '4rem 2rem' }}>
        <header style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ fontSize: '3.5rem', marginBottom: '1rem', letterSpacing: '-0.02em', color: 'var(--primary)' }}>Digital Curatorship</h1>
            <p style={{ fontSize: '1.25rem', color: 'var(--on-surface-variant)', fontFamily: 'var(--font-functional)' }}>Kıvılcım Uygulaması Yönetim Merkezi</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--surface-low)', padding: '0.4rem', borderRadius: '8px', border: '1px solid var(--outline-variant)' }}>
            {[ { code: 'tr', label: 'TR', name: 'Türkçe' }, { code: 'en', label: 'EN', name: 'English' }, { code: 'de', label: 'DE', name: 'Deutsch' }, { code: 'es', label: 'ES', name: 'Español' } ].map(lang => (
              <button key={lang.code} onClick={() => setCurrentLang(lang.code)} style={{ background: currentLang === lang.code ? 'var(--primary-container)' : 'transparent', color: currentLang === lang.code ? 'var(--on-primary)' : 'var(--on-surface-variant)', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', fontFamily: 'var(--font-functional)', fontWeight: '600', fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.2s ease' }} title={lang.name}> {lang.label} </button>
            ))}
          </div>
        </header>

        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2.5fr)', gap: '4rem', alignItems: 'start' }}>
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
            <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1rem', color: 'var(--on-surface-variant)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gezinme</h3>
              <button className={`tab-button ${activeTab === 'kitap' ? 'active' : ''}`} onClick={() => navigateToTab('kitap')}> <BookOpen size={18}/> Kitaplar </button>
              <button className={`tab-button ${activeTab === 'kategori' ? 'active' : ''}`} onClick={() => navigateToTab('kategori')}> <Layers size={18}/> Kategoriler </button>
              <button className={`tab-button ${activeTab === 'yazar' ? 'active' : ''}`} onClick={() => navigateToTab('yazar')}> <Users size={18}/> Yazarlar </button>
              <button className={`tab-button ${activeTab === 'hikaye' ? 'active' : ''}`} onClick={() => navigateToTab('hikaye')}> <FileText size={18}/> Hikayeler </button>
              <div style={{ marginTop: 'auto', paddingTop: '2rem', borderTop: '1px solid var(--outline-variant)' }}>
                <button className="button-danger" onClick={handleClearData} disabled={loading} style={{ width: '100%', fontSize: '0.8rem' }}> <Trash2 size={16}/> Kataloğu Sıfırla </button>
              </div>
            </div>
          </div>

          <div className="card-highest" style={{ padding: '0', backgroundColor: 'var(--surface-lowest)' }}>
            <div style={{ padding: '2rem 3rem', borderBottom: '1px solid var(--outline-variant)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '1rem', textTransform: 'capitalize', margin: 0 }}> {activeTab === 'kitap' ? 'Kitaplar' : activeTab === 'kategori' ? 'Kategoriler' : activeTab === 'yazar' ? 'Yazarlar' : 'Hikayeler'} <span style={{ fontSize: '1rem', color: 'var(--on-surface-variant)', fontFamily: 'var(--font-functional)', fontWeight: '500' }}> {dataList.length} Toplam Kayıt </span> </h2>
                <div className="input-group" style={{ flexDirection: 'row', alignItems: 'center', background: 'var(--surface-low)', borderRadius: '8px', padding: '0.2rem 1rem', border: '1px solid var(--outline-variant)' }}>
                  <Search size={18} color="var(--on-surface-variant)" />
                  <input type="text" placeholder="Tüm alanlarda ara..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} style={{ background: 'transparent', border: 'none', color: 'var(--on-surface)', padding: '0.5rem', outline: 'none', fontFamily: 'var(--font-functional)', minWidth: '250px' }} />
                </div>
              </div>
              {(filterAuthor || filterCategory || filterBookNo) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: '4px', padding: '0.2rem 0.5rem' }}> Filtre: {filterAuthor || filterCategory || `Kitap No: ${filterBookNo}`} </span>
                  <button className="button-tertiary" onClick={() => navigateToTab(activeTab)} style={{ fontSize: '0.8rem', padding: '0' }}> Filtreyi Temizle </button>
                </div>
              )}
            </div>

            <div className="table-container">
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
                  {activeTab === 'kategori' && (
                    <tr>
                      <th style={{ cursor: 'pointer' }} onClick={() => handleSort('name')}>Kategori Adı {renderSortIcon('name')}</th>
                      <th style={{ cursor: 'pointer' }} onClick={() => handleSort('book_count')}>Kayıtlı Kitap Sayısı {renderSortIcon('book_count')}</th>
                      <th>İşlem</th>
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
                          <td><a href="#" className="table-link" onClick={(e) => { e.preventDefault(); navigateToTab('kitap', { category: item.category }); }}>{item.category}</a></td>
                          <td style={{ textAlign: 'center' }}><span style={{ background: 'var(--surface-high)', color: 'var(--primary)', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '600', fontFamily: 'var(--font-functional)', border: '1px solid var(--outline-variant)' }}>{item.story_count}</span></td>
                          <td style={{ fontSize: '0.875rem' }}>{item.publish_year}</td>
                        </tr>
                      )}
                      {activeTab === 'kategori' && (
                        <tr>
                          <td style={{ fontSize: '1.1rem' }}>{item.name}</td>
                          <td style={{ color: 'var(--on-surface-variant)' }}>{item.book_count} Kitap</td>
                          <td><a href="#" className="table-link" onClick={(e) => { e.preventDefault(); navigateToTab('kitap', { category: item.name }); }}>İlgili Kitapları Gör →</a></td>
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
                          <td style={{ color: 'var(--primary)', fontWeight: '500' }}>{item.book_no}</td>
                          <td><a href="#" className="table-link" onClick={(e) => { e.preventDefault(); navigateToTab('kitap', { bookNo: item.book_no }); }}>{item.book_title}</a></td>
                          <td style={{ fontSize: '1.1rem' }}><a href="#" className="table-link" onClick={(e) => { e.preventDefault(); setSelectedStory(item); }} style={{ color: 'var(--on-surface)' }}>{item.title}</a></td>
                          <td style={{ color: 'var(--on-surface-variant)', fontSize: '0.875rem', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.description}</td>
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
            </div>
          </div>
        </section>
      </div>

      {selectedStory && (
        <div className="modal-overlay" onClick={() => setSelectedStory(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ position: 'absolute', top: '1.5rem', right: '4rem', display: 'flex', gap: '0.5rem' }}>
              <button className="button-primary" style={{ padding: '0.5rem 1rem' }} onClick={() => handleShare(selectedStory)}>
                <Share2 size={16} /> Paylaş
              </button>
              <button className="modal-close" style={{ position: 'static' }} onClick={() => setSelectedStory(null)}> <X size={24} /> </button>
            </div>
            <div style={{ marginBottom: '2rem' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-functional)', fontWeight: '500', display: 'block', marginBottom: '0.5rem' }}> Hikaye Kodu: {selectedStory.book_no} </span>
              <h2 style={{ fontSize: '3rem', lineHeight: '1.2', marginBottom: '1rem' }}>{selectedStory.title}</h2>
              <p style={{ fontSize: '1.25rem', color: 'var(--on-surface-variant)', fontStyle: 'italic', borderLeft: '2px solid var(--primary)', paddingLeft: '1rem' }}> {selectedStory.description} </p>
            </div>
            <div style={{ fontSize: '1.125rem', lineHeight: '1.8', color: 'var(--on-surface)' }}> {renderStoryContent(selectedStory.content)} </div>
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

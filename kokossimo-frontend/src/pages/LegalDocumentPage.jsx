import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getLegalDocument } from '../services/api';
import './LegalDocumentPage.css';

const LegalDocumentPage = () => {
  const { slug } = useParams();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    getLegalDocument(slug)
      .then((res) => {
        setDoc(res.data);
      })
      .catch((err) => {
        setError(err?.response?.status === 404 ? 'Документ не найден.' : 'Не удалось загрузить документ.');
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="legal-doc-page page-animation">
        <div className="container">
          <p className="legal-doc-page__loading">Загрузка документа…</p>
        </div>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="legal-doc-page page-animation">
        <div className="container">
          <p className="legal-doc-page__error">{error || 'Документ не найден.'}</p>
          <Link to="/documents" className="legal-doc-page__back">
            ← К списку документов
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="legal-doc-page page-animation">
      <div className="container">
        <div className="legal-doc-page__breadcrumbs">
          <Link to="/">ГЛАВНАЯ</Link>
          <span> — </span>
          <Link to="/documents">ДОКУМЕНТЫ</Link>
          <span> — </span>
          <span>{doc.title}</span>
        </div>

        <h1 className="legal-doc-page__title">{doc.title}</h1>

        <div
          className="legal-doc-page__content"
          dangerouslySetInnerHTML={{
            __html: doc.content
              .split(/\n\n+/)
              .map((p) => p.trim())
              .filter(Boolean)
              .map((p) => `<p>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br />')}</p>`)
              .join(''),
          }}
        />

        <Link to="/documents" className="legal-doc-page__back">
          ← К списку документов
        </Link>
      </div>
    </div>
  );
};

export default LegalDocumentPage;

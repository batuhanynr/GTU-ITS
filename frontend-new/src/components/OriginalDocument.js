import React, { useState } from 'react';
import axios from 'axios';
import authService from '../services/authService';
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export default function OriginalDocument({ internship }) {
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const download = async () => {
        setBusy(true);
        setError('');
        try {
            // Fetch privately stored PDFs with the same token used for internship access.
            const response = await axios.get(`${API_URL}/internship/${internship.id}/document`, {
                headers: { Authorization: `Bearer ${authService.getToken()}` }, responseType: 'blob'
            });
            const url = URL.createObjectURL(response.data);
            const link = document.createElement('a');
            link.href = url;
            link.download = `staj-${internship.id}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch { setError('PDF indirilemedi.'); }
        finally { setBusy(false); }
    };
    if (!internship.hasOriginalDocument) return <span>PDF saklanmamış</span>;
    return <><button disabled={busy} onClick={download}>PDF indir</button>{error && <span role="alert">{error}</span>}</>;
}

import React, { useState } from 'react';
import axios from 'axios';
import authService from '../services/authService';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export default function InternshipActions({ internship, onSaved }) {
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const canDelete = ['General Admin', 'Commission Chair'].includes(authService.getCurrentUser()?.role?.name);
    const config = { headers: { Authorization: `Bearer ${authService.getToken()}` } };
    const open = () => {
        setForm({ companyName: internship.company, startDate: internship.startDate.slice(0, 10),
            endDate: internship.endDate.slice(0, 10), durationDays: internship.durationDays });
        setError('');
        setEditing(true);
    };
    const save = async event => {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
            await axios.put(`${API_URL}/internship/${internship.id}`, { ...form, durationDays: Number(form.durationDays) }, config);
            setEditing(false);
            await onSaved();
        } catch (err) { setError(err.response?.data?.error || 'Kayıt güncellenemedi.'); }
        finally { setBusy(false); }
    };
    const remove = async () => {
        // Require confirmation because deleting a record also removes its grade.
        if (!window.confirm('Bu staj ve varsa notu silinecek. Devam edilsin mi?')) return;
        setBusy(true);
        setError('');
        try {
            await axios.delete(`${API_URL}/internship/${internship.id}`, config);
            await onSaved();
        } catch (err) { setError(err.response?.data?.error || 'Kayıt silinemedi.'); }
        finally { setBusy(false); }
    };
    return <div>
        <button disabled={busy} onClick={open}>Düzenle</button>
        {canDelete && <button disabled={busy} onClick={remove}>Sil</button>}
        {editing && <form onSubmit={save} aria-label="Staj düzenle">
            <label>Kurum<input required value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} /></label>
            <label>Başlangıç<input required type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></label>
            <label>Bitiş<input required type="date" min={form.startDate} value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} /></label>
            <label>İş günü<input required type="number" min="1" value={form.durationDays} onChange={e => setForm({ ...form, durationDays: e.target.value })} /></label>
            <button disabled={busy} type="submit">Kaydet</button>
            <button disabled={busy} type="button" onClick={() => setEditing(false)}>İptal</button>
        </form>}
        {error && <p role="alert">{error}</p>}
    </div>;
}

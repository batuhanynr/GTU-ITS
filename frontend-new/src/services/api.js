import axios from 'axios';

const api = axios.create();
// Read the current token for each request, including requests made after login.
api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});
export default api;

import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

export const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch {
      setError('로그인에 실패했습니다. Firebase Authentication의 이메일/비밀번호 계정을 확인하세요.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-lg p-7">
        <div className="text-xs font-bold text-blue-900 mb-2">사단법인 너브내행복나눔재단</div>
        <h1 className="text-2xl font-black text-slate-900">기부금영수증 발급시스템</h1>
        <p className="text-sm text-slate-500 mt-2">Firebase에 연결된 관리자 계정으로 로그인하세요.</p>
        <label className="block text-sm font-bold mt-6 mb-1">이메일</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="w-full border rounded-lg px-3 py-2.5" />
        <label className="block text-sm font-bold mt-4 mb-1">비밀번호</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required className="w-full border rounded-lg px-3 py-2.5" />
        {error && <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}
        <button className="w-full mt-5 bg-blue-900 text-white font-bold py-3 rounded-lg">로그인</button>
      </form>
    </div>
  );
};

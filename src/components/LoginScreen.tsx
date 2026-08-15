import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import {
  ShieldCheck,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
  Lock,
  Mail,
  KeyRound,
  Server,
  RefreshCw,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { auth, getFirebaseDiagnostics } from '../firebase';
import { testFirestoreConnection, type FirestoreConnectionStatus } from '../utils/firebaseDb';

export const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [firestoreStatus, setFirestoreStatus] = useState<FirestoreConnectionStatus | null>(null);
  const [errorInfo, setErrorInfo] = useState<{
    code: string;
    categoryTitle: string;
    explanation: string;
    rawMessage: string;
  } | null>(null);
  const [lastErrorCode, setLastErrorCode] = useState<string | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(true);

  const diagnostics = getFirebaseDiagnostics();

  // Test Firebase Firestore connection on mount
  const runPreLoginTests = async () => {
    setIsTesting(true);
    try {
      const fsStatus = await testFirestoreConnection();
      setFirestoreStatus(fsStatus);
    } catch (e: any) {
      setFirestoreStatus({
        connected: false,
        message: 'Firestore 연결 점검 중 오류가 발생했습니다.',
        errorDetail: e?.message || String(e),
        code: e?.code,
      });
    } finally {
      setIsTesting(false);
    }
  };

  useEffect(() => {
    runPreLoginTests();
  }, []);

  const categorizeAuthError = (code: string, rawMessage: string) => {
    const norm = code.toLowerCase();

    if (
      norm.includes('api-key-not-valid') ||
      norm.includes('invalid-api-key') ||
      code === 'auth/invalid-api-key'
    ) {
      return {
        categoryTitle: 'Firebase API Key 설정 오류 (auth/invalid-api-key)',
        explanation:
          'Firebase Web SDK API Key가 유효하지 않거나 비활성화되어 있습니다. Firebase Console > 프로젝트 설정 > 일반 > 웹 앱의 apiKey를 확인하세요.',
      };
    }

    if (norm.includes('invalid-credential') || code === 'auth/invalid-credential') {
      return {
        categoryTitle: '인증 정보 불일치 (auth/invalid-credential)',
        explanation:
          '입력하신 이메일 또는 비밀번호가 Firebase Authentication에 등록된 정보와 일치하지 않습니다.',
      };
    }

    if (norm.includes('user-not-found') || code === 'auth/user-not-found') {
      return {
        categoryTitle: '계정 없음 (auth/user-not-found)',
        explanation: `Firebase Console의 Authentication > Users 목록에 '${email.trim()}' 계정이 존재하지 않습니다.`,
      };
    }

    if (norm.includes('wrong-password') || code === 'auth/wrong-password') {
      return {
        categoryTitle: '비밀번호 불일치 (auth/wrong-password)',
        explanation: '비밀번호가 올바르지 않습니다. 정확한 비밀번호를 다시 입력하세요.',
      };
    }

    if (norm.includes('invalid-email') || code === 'auth/invalid-email') {
      return {
        categoryTitle: '이메일 형식 오류 (auth/invalid-email)',
        explanation: '유효한 이메일 주소 형식이 아닙니다. 앞뒤 공백이나 오타를 확인하세요.',
      };
    }

    if (norm.includes('too-many-requests') || code === 'auth/too-many-requests') {
      return {
        categoryTitle: '로그인 시도 횟수 초과 (auth/too-many-requests)',
        explanation:
          '로그인 시도가 너무 많아 일시적으로 차단되었습니다. 잠시 후(수 분 뒤) 다시 시도하거나 Firebase Console에서 비밀번호를 재설정하세요.',
      };
    }

    if (norm.includes('network-request-failed') || code === 'auth/network-request-failed') {
      return {
        categoryTitle: '네트워크 연결 오류 (auth/network-request-failed)',
        explanation:
          'Firebase 인증 서버와 통신할 수 없습니다. 인터넷 연결 및 네트워크 프록시 설정을 확인하세요.',
      };
    }

    if (
      norm.includes('operation-not-allowed') ||
      norm.includes('configuration-not-found') ||
      code === 'auth/operation-not-allowed' ||
      code === 'auth/configuration-not-found'
    ) {
      return {
        categoryTitle: '로그인 공급업체 비활성화 (auth/operation-not-allowed)',
        explanation:
          'Firebase Console > Authentication > Sign-in method에서 [이메일/비밀번호]가 사용 설정되어 있는지 확인하세요.',
      };
    }

    if (norm.includes('user-disabled') || code === 'auth/user-disabled') {
      return {
        categoryTitle: '계정 비활성화 (auth/user-disabled)',
        explanation: '해당 관리자 계정이 비활성화(정지) 상태입니다. Firebase Console의 Users 목록을 확인하세요.',
      };
    }

    return {
      categoryTitle: `인증 오류 (${code})`,
      explanation: 'Firebase Authentication 처리 중 오류가 발생했습니다.',
    };
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) {
      setErrorInfo({
        code: 'auth/not-initialized',
        categoryTitle: 'Firebase Auth 미초기화',
        explanation: 'Firebase Authentication 인스턴스가 생성되지 않았습니다.',
        rawMessage: 'Firebase App is not initialized',
      });
      setLastErrorCode('auth/not-initialized');
      return;
    }

    setIsLoading(true);
    setErrorInfo(null);

    try {
      // Firebase SDK native method
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // Successful login triggers onAuthStateChanged in App.tsx
    } catch (err: any) {
      console.error('Firebase Auth Login Error Object:', err);
      const code = err?.code || 'unknown-error';
      const rawMessage = err?.message || String(err);
      setLastErrorCode(code);

      const { categoryTitle, explanation } = categorizeAuthError(code, rawMessage);
      setErrorInfo({
        code,
        categoryTitle,
        explanation,
        rawMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Main Login Card */}
        <form
          onSubmit={handleLogin}
          className="bg-white rounded-2xl border border-slate-200 shadow-xl p-7 relative"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-blue-900 mb-2">
            <ShieldCheck className="w-4 h-4 text-blue-700" />
            <span>사단법인 너브내행복나눔재단</span>
          </div>

          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            기부금영수증 발급시스템
          </h1>
          <p className="text-xs text-slate-500 mt-1.5">
            Cloud Firestore 및 Authentication 연동 관리자 로그인
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                <span>관리자 이메일</span>
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                placeholder="예: hcdmh1026@naver.com"
                autoComplete="email"
                className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span>비밀번호</span>
              </label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                placeholder="비밀번호 입력"
                autoComplete="current-password"
                className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900 bg-white"
              />
            </div>
          </div>

          {/* Explicit Error Display - Shows Exact Firebase Code & Description */}
          {errorInfo && (
            <div className="mt-5 text-xs bg-red-50 border border-red-200 rounded-xl p-4 text-red-950 animate-fadeIn space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <div className="font-bold text-red-900 text-sm">
                    {errorInfo.categoryTitle}
                  </div>
                  <p className="text-red-800 text-xs leading-relaxed">
                    {errorInfo.explanation}
                  </p>
                  <div className="pt-2 border-t border-red-200 space-y-1 text-[11px] font-mono">
                    <div>
                      <span className="text-red-600 font-semibold">실제 error.code:</span>{' '}
                      <span className="bg-red-100 px-1.5 py-0.5 rounded text-red-900 font-bold">
                        {errorInfo.code}
                      </span>
                    </div>
                    <div className="text-slate-600 text-[10px] break-all">
                      <span className="font-semibold text-slate-700">Firebase 메시지:</span> {errorInfo.rawMessage}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-6 bg-blue-900 hover:bg-blue-950 text-white font-bold py-3 rounded-lg text-sm transition-colors shadow-sm disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Firebase Authentication 인증 중...</span>
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                <span>관리자 로그인</span>
              </>
            )}
          </button>
        </form>

        {/* Developer Diagnostics Box */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700">
          <div className="flex items-center justify-between font-bold text-slate-800 mb-2">
            <div className="flex items-center gap-1.5">
              <Server className="w-4 h-4 text-blue-800" />
              <span>Firebase 실시간 진단 정보 (Diagnostics)</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={runPreLoginTests}
                disabled={isTesting}
                title="연결 상태 다시 점검"
                className="p-1 hover:bg-slate-200 rounded text-slate-600 hover:text-slate-900 cursor-pointer flex items-center gap-1 text-[10px]"
              >
                <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} />
                <span>재검사</span>
              </button>
              <button
                type="button"
                onClick={() => setShowDiagnostics(!showDiagnostics)}
                className="p-1 hover:bg-slate-200 rounded text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                {showDiagnostics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {showDiagnostics && (
            <div className="pt-2 border-t border-slate-200 space-y-2 text-[11px] font-mono">
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-500 font-sans">Project ID:</span>
                <span className="font-bold text-blue-900 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                  {diagnostics.projectId}
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-500 font-sans">Auth Domain:</span>
                <span className="text-slate-800">{diagnostics.authDomain}</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-500 font-sans">API Key (앞 6자리):</span>
                <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  {diagnostics.apiKeyPrefix}
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-500 font-sans">App ID (앞 10자리):</span>
                <span className="text-slate-800 font-bold">
                  {diagnostics.appIdPrefix}
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-500 font-sans">Firebase App 초기화:</span>
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" />
                  <span>{diagnostics.appName} ({diagnostics.isAppInitialized ? '초기화 성공' : '실패'})</span>
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-500 font-sans">Authentication 연결 상태:</span>
                <span className={diagnostics.isAuthConnected ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold'}>
                  {diagnostics.isAuthConnected ? '연결 완료 (getAuth 바인딩됨)' : '미연결'}
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-500 font-sans">Firestore 사전 점검:</span>
                <span className={firestoreStatus?.connected ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                  {isTesting ? (
                    '점검 중...'
                  ) : firestoreStatus?.connected ? (
                    '정상 연결됨'
                  ) : (
                    <span>
                      {firestoreStatus?.code === 'permission-denied'
                        ? '보안규칙 정상(로그인 필요)'
                        : firestoreStatus?.code || '연결 대기'}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-500 font-sans">최근 발생한 error.code:</span>
                <span className={lastErrorCode ? 'text-red-700 font-bold bg-red-50 px-1.5 py-0.5 rounded border border-red-200' : 'text-slate-400'}>
                  {lastErrorCode || '없음'}
                </span>
              </div>

              <div className="pt-2 mt-2 border-t border-slate-200 text-[10px] text-slate-500 font-sans flex items-start gap-1">
                <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span>
                  로그인 시 Firebase Authentication의 이메일과 비밀번호를 검증합니다. 비밀번호는 보안상 어디에도 기록되거나 노출되지 않습니다.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

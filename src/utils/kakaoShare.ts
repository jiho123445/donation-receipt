/**
 * 카카오톡 "공유하기" (Kakao Share) 연동 유틸리티
 *
 * 카카오 비즈니스 채널 승인이나 알림톡 없이도, 무료로 발급받는
 * Kakao Developers JavaScript 키만 있으면 실제로 카카오톡 친구/대화방을
 * 선택해서 메시지를 전송할 수 있는 공식 "공유하기" API를 사용합니다.
 *
 * 사전 준비 (지호님이 해주셔야 하는 것):
 * 1) https://developers.kakao.com 에서 애플리케이션 생성 (무료, 약 5분)
 * 2) [내 애플리케이션] > [앱 키] 에서 "JavaScript 키" 복사
 * 3) [내 애플리케이션] > [카카오 로그인] > [플랫폼] > "Web" 에 이 앱이
 *    배포될 도메인(예: https://your-domain.com, 로컬 테스트 시
 *    http://localhost:3000)을 등록
 * 4) .env 파일에 VITE_KAKAO_JS_KEY=발급받은JS키 형태로 설정
 */

declare global {
  interface Window {
    Kakao?: {
      init: (key: string) => void;
      isInitialized: () => boolean;
      Share: {
        sendDefault: (settings: Record<string, unknown>) => void;
      };
    };
  }
}

const KAKAO_SDK_SRC = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js';

let sdkLoadPromise: Promise<void> | null = null;

/** VITE_KAKAO_JS_KEY 환경변수가 설정되어 있는지 여부 */
export function isKakaoConfigured(): boolean {
  return Boolean(import.meta.env.VITE_KAKAO_JS_KEY);
}

/** 카카오 SDK 스크립트를 로드하고 초기화합니다. (최초 1회만 네트워크 요청) */
export function loadKakaoSdk(): Promise<void> {
  const jsKey = import.meta.env.VITE_KAKAO_JS_KEY as string | undefined;

  if (!jsKey) {
    return Promise.reject(
      new Error('카카오 JS 키(VITE_KAKAO_JS_KEY)가 설정되지 않았습니다. .env 파일을 확인해주세요.')
    );
  }

  if (window.Kakao?.isInitialized?.()) {
    return Promise.resolve();
  }

  if (sdkLoadPromise) return sdkLoadPromise;

  sdkLoadPromise = new Promise<void>((resolve, reject) => {
    const finishInit = () => {
      try {
        if (!window.Kakao) {
          reject(new Error('카카오 SDK 로드에 실패했습니다.'));
          return;
        }
        if (!window.Kakao.isInitialized()) {
          window.Kakao.init(jsKey);
        }
        resolve();
      } catch (err) {
        reject(err);
      }
    };

    const existingScript = document.getElementById('kakao-sdk-script') as HTMLScriptElement | null;
    if (existingScript) {
      if (window.Kakao) {
        finishInit();
      } else {
        existingScript.addEventListener('load', finishInit, { once: true });
        existingScript.addEventListener('error', () => reject(new Error('카카오 SDK 로드 실패')), {
          once: true,
        });
      }
      return;
    }

    const script = document.createElement('script');
    script.id = 'kakao-sdk-script';
    script.src = KAKAO_SDK_SRC;
    script.crossOrigin = 'anonymous';
    script.onload = finishInit;
    script.onerror = () => reject(new Error('카카오 SDK 로드 실패 (네트워크 확인 필요)'));
    document.head.appendChild(script);
  });

  return sdkLoadPromise;
}

export interface KakaoShareParams {
  /** 대화상대에게 보일 요약 텍스트 (카카오 텍스트 템플릿, 넉넉히 300자 내외 권장) */
  text: string;
  /** 첨부/다운로드 링크로 사용할 URL (예: Firebase Storage에 업로드된 PDF 다운로드 URL) */
  linkUrl: string;
  /** 공유 버튼에 표시할 문구 */
  buttonTitle?: string;
}

/**
 * 카카오톡 공유하기 레이어를 띄워 사용자가 친구/대화방을 선택하면
 * 실제로 해당 대화방에 메시지가 전송됩니다. (카카오 로그인 불필요)
 */
export async function shareViaKakao(params: KakaoShareParams): Promise<void> {
  await loadKakaoSdk();

  if (!window.Kakao) {
    throw new Error('카카오 SDK를 사용할 수 없습니다.');
  }

  window.Kakao.Share.sendDefault({
    objectType: 'text',
    text: params.text,
    link: {
      mobileWebUrl: params.linkUrl,
      webUrl: params.linkUrl,
    },
    buttons: [
      {
        title: params.buttonTitle || '기부금영수증 PDF 확인',
        link: {
          mobileWebUrl: params.linkUrl,
          webUrl: params.linkUrl,
        },
      },
    ],
  });
}

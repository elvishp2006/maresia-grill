import { useCallback, useEffect, useRef } from 'react';

export const useHapticFeedback = () => {
  const switchRef = useRef<HTMLInputElement | null>(null);
  const labelRef = useRef<HTMLLabelElement | null>(null);
  const isIOS = useRef(false);

  useEffect(() => {
    isIOS.current = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream;

    if (isIOS.current) {
      const setupSwitch = () => {
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.setAttribute('switch', '');
        input.style.cssText = `
          position: fixed;
          top: -9999px;
          left: -9999px;
          opacity: 0;
          pointer-events: none;
          width: 1px;
          height: 1px;
        `;
        input.id = 'haptic-switch-' + Date.now();

        const label = document.createElement('label');
        label.htmlFor = input.id;
        label.style.cssText = `
          position: fixed;
          top: -9999px;
          left: -9999px;
          opacity: 0;
          pointer-events: auto;
          width: 1px;
          height: 1px;
        `;

        document.body.appendChild(input);
        document.body.appendChild(label);

        switchRef.current = input;
        labelRef.current = label;
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupSwitch);
      } else {
        setupSwitch();
      }

      return () => {
        if (switchRef.current && document.body.contains(switchRef.current)) {
          document.body.removeChild(switchRef.current);
        }
        if (labelRef.current && document.body.contains(labelRef.current)) {
          document.body.removeChild(labelRef.current);
        }
        document.removeEventListener('DOMContentLoaded', setupSwitch);
      };
    }
  }, []);

  const vibrate = useCallback((pattern: number | number[] = 50) => {
    if (isIOS.current && switchRef.current && labelRef.current) {
      try {
        const currentState = switchRef.current.checked;
        switchRef.current.checked = !currentState;
        labelRef.current.click();
        setTimeout(() => {
          if (switchRef.current) {
            switchRef.current.checked = currentState;
          }
        }, 50);
      } catch (error) {
        console.warn('iOS haptic feedback failed:', error);
      }
      return;
    }

    if (typeof window === 'undefined') return;

    try {
      if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
    } catch (error) {
      console.warn('Vibration not supported or blocked:', error);
    }
  }, []);

  const lightTap = useCallback(() => {
    vibrate(50);
  }, [vibrate]);

  const mediumTap = useCallback(() => {
    vibrate(100);
  }, [vibrate]);

  const heavyTap = useCallback(() => {
    vibrate(150);
  }, [vibrate]);

  const doubleTap = useCallback(() => {
    vibrate([50, 100, 50]);
  }, [vibrate]);

  const success = useCallback(() => {
    vibrate([50, 50, 50]);
  }, [vibrate]);

  const error = useCallback(() => {
    vibrate([100, 100, 100]);
  }, [vibrate]);

  return {
    vibrate,
    lightTap,
    mediumTap,
    heavyTap,
    doubleTap,
    success,
    error,
  };
};

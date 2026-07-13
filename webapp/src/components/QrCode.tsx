import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

export function QrCode(props: { value: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, props.value, {
      width: props.size ?? 240,
      margin: 2,
      errorCorrectionLevel: 'M',
    }).catch(() => undefined);
  }, [props.value, props.size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ borderRadius: 12, background: '#fff', maxWidth: '100%' }}
    />
  );
}

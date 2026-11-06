"use client";

import { useEffect, useRef, useState } from "react";

export function usePressingBarcodeScanner(
  onBarcode: (barcode: string) => void,
) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const onBarcodeRef = useRef(onBarcode);

  useEffect(() => {
    onBarcodeRef.current = onBarcode;
  }, [onBarcode]);

  useEffect(
    () => () => {
      controlsRef.current?.stop();
    },
    [],
  );

  function stop() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setIsOpen(false);
  }

  async function start() {
    setMessage(null);
    setIsOpen(true);

    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      const video = videoRef.current;

      if (!video) {
        throw new Error("Camera preview could not start.");
      }

      const controls = await reader.decodeFromVideoDevice(
        undefined,
        video,
        (result, _error, callbackControls) => {
          if (!result) return;
          const barcode = result.getText();
          onBarcodeRef.current(barcode);
          setMessage("Barcode captured. Review it, then search.");
          callbackControls.stop();
          controlsRef.current = null;
          setIsOpen(false);
        },
      );
      controlsRef.current = controls;
    } catch (error) {
      setIsOpen(false);
      setMessage(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Camera permission was denied. Manual barcode entry is still available."
          : "The camera could not scan a barcode. Use manual entry instead.",
      );
    }
  }

  return {
    isOpen,
    message,
    start,
    stop,
    videoRef,
  };
}

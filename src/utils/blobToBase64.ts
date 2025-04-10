const blobToBase64 = (blob: Blob, callback: (base64data: string) => void) => {
  const reader = new FileReader();
  reader.onload = function () {
    const readerResult = reader?.result as string;
    const base64data = readerResult.split(",")[1];
    callback(base64data);
  };
  reader.readAsDataURL(blob);
};

export { blobToBase64 };

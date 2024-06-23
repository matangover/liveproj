document.addEventListener("DOMContentLoaded", () => {
    const srcFileInput = document.getElementById("srcFile");
    const destFileInput = document.getElementById("destFile");
    const copyButton = document.getElementById("copyButton");
    const output = document.getElementById("output");

    let srcFile, destFile;

    srcFileInput.addEventListener("change", (event) => {
        srcFile = event.target.files[0];
        updateButtonState();
    });

    destFileInput.addEventListener("change", (event) => {
        destFile = event.target.files[0];
        updateButtonState();
    });

    copyButton.addEventListener("click", () => {
        if (srcFile && destFile) {
            copyLocators(srcFile, destFile);
        }
    });

    function updateButtonState() {
        copyButton.disabled = !(srcFile && destFile);
    }

    async function copyLocators(srcFile, destFile) {
        try {
            const srcXml = await readProject(srcFile);
            const destXml = await readProject(destFile);

            const locators = srcXml.querySelector("Locators");
            const destLiveSet = destXml.querySelector("LiveSet");
            const oldLocators = destLiveSet.querySelector("Locators");

            destLiveSet.removeChild(oldLocators);
            destLiveSet.appendChild(locators);
            const serializedOutput = await serializeProject(destXml);
            const outputName = destFile.name.replace(".als", "_new.als");
            download(serializedOutput, outputName, "application/xml");
            output.textContent = `Finished! File downloaded to ${outputName}`;
        } catch (error) {
            output.textContent = `Error: ${error.message}`;
        }
    }

    async function readProject(file) {
        const buffer = await readBinaryFile(file);
        try {
            // First try reading the file as XML.
            return await readXml(buffer);
        } catch (error) {
            // Failed, try reading as GZIP-compressed XML.
        }
        const ds = new DecompressionStream("gzip");
        const writer = ds.writable.getWriter();
        writer.write(buffer);
        writer.close();
        const reader = ds.readable.getReader();
        const decompressedBuffer = await readStream(reader);
        return readXml(decompressedBuffer);
    }

    async function serializeProject(xml) {
        const serializer = new XMLSerializer();
        const xmlStr = serializer.serializeToString(xml);
        let encoder = new TextEncoder();
        const xmlBytes = encoder.encode(xmlStr);
        const stream = new CompressionStream("gzip");
        const writer = stream.writable.getWriter();
        writer.write(xmlBytes);
        writer.close();
        return await readStream(stream.readable.getReader());
    }

    async function readXml(buffer) {
        let decoder = new TextDecoder();
        const text = decoder.decode(buffer);
        const parser = new DOMParser();
        const result = parser.parseFromString(text, "text/xml");
        const errorNode = result.querySelector("parsererror");
        if (errorNode) {
            throw new Error(errorNode.textContent);
        } else {
            return result;
        }
    }

    async function readStream(reader) {
        const chunks = [];
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            chunks.push(value);
        }
        const blob = new Blob(chunks);
        return blob.arrayBuffer();
    }

    function readTextFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }

    function readBinaryFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
        });
    }

    function download(content, fileName, contentType) {
        const a = document.createElement("a");
        const file = new Blob([content], { type: contentType });
        a.href = URL.createObjectURL(file);
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(a.href);
    }
});

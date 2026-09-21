    // ============================================================
    // METADATA INJECTOR (MP4, JPEG, PNG, WebP)
    // ============================================================

    // CRC32 table for PNG chunk generation
    let _crcTable = null;
    function getCrcTable() {
        if (_crcTable) return _crcTable;
        const table = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let k = 0; k < 8; k++) {
                c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            }
            table[i] = c >>> 0;
        }
        _crcTable = table;
        return table;
    }

    function calculateCrc32(bytes) {
        const table = getCrcTable();
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < bytes.length; i++) {
            crc = table[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    /**
     * Внедряет метаданные (промпт, ссылку, модель и хэш) в PNG файл через tEXt чанки.
     */
    function injectPngMetadata(buffer, prompt, url, model = '', promptHash = '') {
        try {
            const u8 = new Uint8Array(buffer);
            // Проверка PNG сигнатуры: 89 50 4E 47 0D 0A 1A 0A
            if (u8.length < 33 || u8[0] !== 0x89 || u8[1] !== 0x50 || u8[2] !== 0x4E || u8[3] !== 0x47) {
                return buffer;
            }

            // Первый чанк IHDR: длина 13 байт (заголовок 8 байт, данные 13, crc 4 = 25 байт). Заканчивается на 8 + 25 = 33
            const insertPos = 33;
            const textEncoder = new TextEncoder();

            function makeTextChunk(keyword, text) {
                const kwBytes = textEncoder.encode(keyword);
                const valBytes = textEncoder.encode(text);
                const chunkData = new Uint8Array(kwBytes.length + 1 + valBytes.length);
                chunkData.set(kwBytes, 0);
                chunkData[kwBytes.length] = 0; // null separator
                chunkData.set(valBytes, kwBytes.length + 1);

                const chunkLen = chunkData.length;
                const chunk = new Uint8Array(8 + chunkLen + 4);
                const view = new DataView(chunk.buffer);
                view.setUint32(0, chunkLen, false);
                chunk[4] = 0x74; chunk[5] = 0x45; chunk[6] = 0x58; chunk[7] = 0x74; // 'tEXt'
                chunk.set(chunkData, 8);

                // CRC считается от типа чанка (4 байта) + данных чанка
                const crcBytes = chunk.subarray(4, 8 + chunkLen);
                const crc = calculateCrc32(crcBytes);
                view.setUint32(8 + chunkLen, crc, false);
                return chunk;
            }

            const commentText = `Prompt: ${prompt}\nURL: ${url}${model ? `\nModel: ${model}` : ''}${promptHash ? `\nHash: ${promptHash}` : ''}`;
            const chunks = [
                makeTextChunk('Description', prompt),
                makeTextChunk('Comment', commentText),
                makeTextChunk('Source', url),
                makeTextChunk('prompt', prompt),
                makeTextChunk('parameters', prompt)
            ];
            if (model) {
                chunks.push(makeTextChunk('source', model));
                chunks.push(makeTextChunk('model', model));
            }
            if (promptHash) {
                chunks.push(makeTextChunk('prompt_hash', promptHash));
            }
            chunks.push(makeTextChunk('timestamp', new Date().toISOString().replace('T', ' ').slice(0, 19)));

            const totalChunksLen = chunks.reduce((acc, c) => acc + c.length, 0);
            const result = new Uint8Array(u8.length + totalChunksLen);
            result.set(u8.subarray(0, insertPos), 0);
            let offset = insertPos;
            for (const ch of chunks) {
                result.set(ch, offset);
                offset += ch.length;
            }
            result.set(u8.subarray(insertPos), offset);
            return result.buffer;
        } catch (e) {
            console.warn('[MOSSAD] injectPngMetadata error:', e);
            return buffer;
        }
    }

    /**
     * Внедряет метаданные (промпт, ссылку, модель и хэш) в JPEG файл через COM и XMP маркеры.
     */
    function injectJpegMetadata(buffer, prompt, url, model = '', promptHash = '') {
        try {
            const u8 = new Uint8Array(buffer);
            if (u8.length < 4 || u8[0] !== 0xFF || u8[1] !== 0xD8) {
                return buffer; // Не JPEG
            }

            const textEncoder = new TextEncoder();
            const comText = `Prompt: ${prompt}\nURL: ${url}${model ? `\nModel: ${model}` : ''}${promptHash ? `\nHash: ${promptHash}` : ''}`;
            const comBytes = textEncoder.encode(comText);
            const comLen = Math.min(comBytes.length, 65530);

            // 1. COM маркер: FF FE [длина 2 байта] [текст]
            const comMarker = new Uint8Array(4 + comLen);
            comMarker[0] = 0xFF; comMarker[1] = 0xFE;
            const comView = new DataView(comMarker.buffer);
            comView.setUint16(2, comLen + 2, false);
            comMarker.set(comBytes.subarray(0, comLen), 4);

            // 2. XMP APP1 маркер: FF E1 [длина 2 байта] [http://ns.adobe.com/xap/1.0/\0] [XML]
            const escapeXml = (s) => (s || '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;' }[c]));
            const cleanXmlPrompt = escapeXml(prompt);
            const cleanXmlUrl = escapeXml(url);
            const cleanXmlModel = escapeXml(model || 'Grok');
            const cleanXmlTitle = escapeXml((prompt || '').slice(0, 60));
            const cleanXmlHash = escapeXml(promptHash);

            const xmpXml = `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:description><rdf:Alt><rdf:li xml:lang="x-default">${cleanXmlPrompt}</rdf:li></rdf:Alt></dc:description><dc:source>${cleanXmlUrl}</dc:source><dc:creator><rdf:Seq><rdf:li>${cleanXmlModel}</rdf:li></rdf:Seq></dc:creator><dc:title><rdf:Alt><rdf:li xml:lang="x-default">${cleanXmlTitle}</rdf:li></rdf:Alt></dc:title><dc:identifier>${cleanXmlHash}</dc:identifier></rdf:Description></rdf:RDF></x:xmpmeta>`;
            const xmpHeader = textEncoder.encode('http://ns.adobe.com/xap/1.0/\0');
            const xmpXmlBytes = textEncoder.encode(xmpXml);
            const xmpPayloadLen = xmpHeader.length + xmpXmlBytes.length;

            let xmpMarker = null;
            if (xmpPayloadLen + 2 < 65535) {
                xmpMarker = new Uint8Array(4 + xmpPayloadLen);
                xmpMarker[0] = 0xFF; xmpMarker[1] = 0xE1;
                const xmpView = new DataView(xmpMarker.buffer);
                xmpView.setUint16(2, xmpPayloadLen + 2, false);
                xmpMarker.set(xmpHeader, 4);
                xmpMarker.set(xmpXmlBytes, 4 + xmpHeader.length);
            }

            // Находим место вставки: сразу после SOI (байты 0, 1) или после APP0 (FF E0), если он есть
            let insertPos = 2;
            if (u8.length > 4 && u8[2] === 0xFF && u8[3] === 0xE0) {
                const app0Len = (u8[4] << 8) | u8[5];
                insertPos = 4 + app0Len;
            }

            const extraLen = comMarker.length + (xmpMarker ? xmpMarker.length : 0);
            const result = new Uint8Array(u8.length + extraLen);
            result.set(u8.subarray(0, insertPos), 0);
            let curPos = insertPos;
            result.set(comMarker, curPos);
            curPos += comMarker.length;
            if (xmpMarker) {
                result.set(xmpMarker, curPos);
                curPos += xmpMarker.length;
            }
            result.set(u8.subarray(insertPos), curPos);
            return result.buffer;
        } catch (e) {
            console.warn('[MOSSAD] injectJpegMetadata error:', e);
            return buffer;
        }
    }

    /**
     * Внедряет метаданные (промпт, ссылку, модель и хэш) в MP4 (ISO BMFF / QuickTime) в атом moov.udta.meta.ilst.
     * Корректирует таблицы смещений чанков stco/co64 при сдвиге mdat.
     */
    function injectMp4Metadata(buffer, prompt, url, model = '', promptHash = '') {
        try {
            const u8 = new Uint8Array(buffer);
            const view = new DataView(buffer);
            const len = u8.length;

            // Парсим верхнеуровневые атомы
            let pos = 0;
            let moovStart = -1, moovLen = 0;
            let mdatStart = -1;

            while (pos + 8 <= len) {
                let boxSize = view.getUint32(pos, false);
                const bType = String.fromCharCode(u8[pos+4], u8[pos+5], u8[pos+6], u8[pos+7]);
                let headerLen = 8;
                if (boxSize === 1 && pos + 16 <= len) {
                    // 64-битный размер
                    const hi = view.getUint32(pos + 8, false);
                    const lo = view.getUint32(pos + 12, false);
                    boxSize = hi * 4294967296 + lo;
                    headerLen = 16;
                } else if (boxSize === 0) {
                    boxSize = len - pos;
                }
                if (boxSize < headerLen || pos + boxSize > len) break;

                if (bType === 'moov') {
                    moovStart = pos;
                    moovLen = boxSize;
                } else if (bType === 'mdat') {
                    mdatStart = pos;
                }
                pos += boxSize;
            }

            if (moovStart === -1 || moovLen === 0) {
                return buffer; // moov не найден
            }

            const textEncoder = new TextEncoder();

            function makeMp4Box(typeStr, payloadBytes) {
                const box = new Uint8Array(8 + payloadBytes.length);
                const bView = new DataView(box.buffer);
                bView.setUint32(0, box.length, false);
                for (let i = 0; i < 4; i++) {
                    box[4 + i] = typeStr.charCodeAt(i);
                }
                box.set(payloadBytes, 8);
                return box;
            }

            function makeIlstItem(tagBytes, text) {
                const textBytes = textEncoder.encode(text);
                // Box 'data': 4 байта длина (16 + textBytes.length), 'data', 1 байт version=0, 3 байта flags=1 (UTF-8), 4 байта locale=0
                const dataBox = new Uint8Array(16 + textBytes.length);
                const dView = new DataView(dataBox.buffer);
                dView.setUint32(0, dataBox.length, false);
                dataBox[4] = 0x64; dataBox[5] = 0x61; dataBox[6] = 0x74; dataBox[7] = 0x61; // 'data'
                dataBox[8] = 0; dataBox[9] = 0; dataBox[10] = 0; dataBox[11] = 1; // version 0, type 1 (UTF-8)
                dView.setUint32(12, 0, false); // locale 0
                dataBox.set(textBytes, 16);

                const itemBox = new Uint8Array(8 + dataBox.length);
                const iView = new DataView(itemBox.buffer);
                iView.setUint32(0, itemBox.length, false);
                itemBox.set(tagBytes, 4);
                itemBox.set(dataBox, 8);
                return itemBox;
            }

            // Собираем элементы ilst
            const tagDes = new Uint8Array([0xA9, 0x64, 0x65, 0x73]); // '©des' (Description)
            const tagCmt = new Uint8Array([0xA9, 0x63, 0x6D, 0x74]); // '©cmt' (Comment)
            const tagUrl1 = new Uint8Array([0x70, 0x75, 0x72, 0x6C]); // 'purl' (Posting URL)
            const tagUrl2 = new Uint8Array([0xA9, 0x75, 0x72, 0x6C]); // '©url' (URL)
            const tagArt  = new Uint8Array([0xA9, 0x41, 0x52, 0x54]); // '©ART' (Artist / Model)
            const tagNam  = new Uint8Array([0xA9, 0x6E, 0x61, 0x6D]); // '©nam' (Title)

            const commentText = `Prompt: ${prompt}\nURL: ${url}${model ? `\nModel: ${model}` : ''}${promptHash ? `\nHash: ${promptHash}` : ''}`;
            const items = [
                makeIlstItem(tagDes, prompt),
                makeIlstItem(tagCmt, commentText),
                makeIlstItem(tagUrl1, url),
                makeIlstItem(tagUrl2, url)
            ];
            if (model) {
                items.push(makeIlstItem(tagArt, model));
            }
            if (prompt) {
                items.push(makeIlstItem(tagNam, prompt.slice(0, 60)));
            }

            const totalItemsLen = items.reduce((acc, it) => acc + it.length, 0);
            const ilstPayload = new Uint8Array(totalItemsLen);
            let ilstOff = 0;
            for (const it of items) {
                ilstPayload.set(it, ilstOff);
                ilstOff += it.length;
            }
            const ilstBox = makeMp4Box('ilst', ilstPayload);

            // Handler box 'hdlr' для meta
            const hdlrBox = new Uint8Array(33);
            const hView = new DataView(hdlrBox.buffer);
            hView.setUint32(0, 33, false);
            hdlrBox[4] = 0x68; hdlrBox[5] = 0x64; hdlrBox[6] = 0x6C; hdlrBox[7] = 0x72; // 'hdlr'
            hView.setUint32(8, 0, false); // version + flags
            hView.setUint32(12, 0, false); // pre_defined
            hdlrBox[16] = 0x6D; hdlrBox[17] = 0x64; hdlrBox[18] = 0x69; hdlrBox[19] = 0x72; // 'mdir'
            hdlrBox[20] = 0x61; hdlrBox[21] = 0x70; hdlrBox[22] = 0x70; hdlrBox[23] = 0x6C; // 'appl'
            hView.setUint32(24, 0, false); // flags
            hView.setUint32(28, 0, false); // flags mask
            hdlrBox[32] = 0; // name empty string

            // Box 'meta': FullBox (version 0 + flags 0 = 4 байта) + hdlr + ilst
            const metaPayload = new Uint8Array(4 + hdlrBox.length + ilstBox.length);
            metaPayload[0] = 0; metaPayload[1] = 0; metaPayload[2] = 0; metaPayload[3] = 0;
            metaPayload.set(hdlrBox, 4);
            metaPayload.set(ilstBox, 4 + hdlrBox.length);
            const metaBox = makeMp4Box('meta', metaPayload);

            // Box 'udta'
            const udtaBox = makeMp4Box('udta', metaBox);

            // Ищем и вырезаем старый udta внутри moov, если он был
            let oldUdtaStart = -1, oldUdtaLen = 0;
            let mPos = moovStart + 8;
            const moovEnd = moovStart + moovLen;

            while (mPos + 8 <= moovEnd) {
                const subSize = view.getUint32(mPos, false);
                const subType = String.fromCharCode(u8[mPos+4], u8[mPos+5], u8[mPos+6], u8[mPos+7]);
                if (subSize < 8 || mPos + subSize > moovEnd) break;
                if (subType === 'udta') {
                    oldUdtaStart = mPos;
                    oldUdtaLen = subSize;
                    break;
                }
                mPos += subSize;
            }

            const delta = udtaBox.length - oldUdtaLen;

            // Создаем копию буфера moov (без старого udta, но с новым udta)
            let moovBodyBeforeUdta, moovBodyAfterUdta;
            if (oldUdtaStart !== -1) {
                moovBodyBeforeUdta = u8.slice(moovStart + 8, oldUdtaStart);
                moovBodyAfterUdta = u8.slice(oldUdtaStart + oldUdtaLen, moovEnd);
            } else {
                moovBodyBeforeUdta = u8.slice(moovStart + 8, moovEnd);
                moovBodyAfterUdta = new Uint8Array(0);
            }

            const newMoovLen = moovLen + delta;
            const newMoovBytes = new Uint8Array(newMoovLen);
            const newMoovView = new DataView(newMoovBytes.buffer);
            newMoovView.setUint32(0, newMoovLen, false);
            newMoovBytes[4] = 0x6D; newMoovBytes[5] = 0x6F; newMoovBytes[6] = 0x6F; newMoovBytes[7] = 0x76; // 'moov'

            let writeOffset = 8;
            newMoovBytes.set(moovBodyBeforeUdta, writeOffset);
            writeOffset += moovBodyBeforeUdta.length;
            newMoovBytes.set(moovBodyAfterUdta, writeOffset);
            writeOffset += moovBodyAfterUdta.length;
            newMoovBytes.set(udtaBox, writeOffset);

            // Если moov расположен до mdat (faststart MP4), смещаем все chunk offsets на величину delta!
            if (mdatStart !== -1 && moovStart < mdatStart && delta !== 0) {
                // Ищем все stco и co64 внутри нового moov
                let scanPos = 0;
                while (scanPos + 8 <= newMoovBytes.length) {
                    const bSize = newMoovView.getUint32(scanPos, false);
                    if (bSize < 8 || scanPos + bSize > newMoovBytes.length) {
                        scanPos++;
                        continue;
                    }
                    const tag = String.fromCharCode(
                        newMoovBytes[scanPos+4], newMoovBytes[scanPos+5],
                        newMoovBytes[scanPos+6], newMoovBytes[scanPos+7]
                    );
                    if (tag === 'stco') {
                        const entryCount = newMoovView.getUint32(scanPos + 12, false);
                        for (let i = 0; i < entryCount; i++) {
                            const curOff = newMoovView.getUint32(scanPos + 16 + i * 4, false);
                            newMoovView.setUint32(scanPos + 16 + i * 4, curOff + delta, false);
                        }
                    } else if (tag === 'co64') {
                        const entryCount = newMoovView.getUint32(scanPos + 12, false);
                        for (let i = 0; i < entryCount; i++) {
                            const curOffHi = newMoovView.getUint32(scanPos + 16 + i * 8, false);
                            const curOffLo = newMoovView.getUint32(scanPos + 20 + i * 8, false);
                            let off = BigInt(curOffHi) * 4294967296n + BigInt(curOffLo);
                            off += BigInt(delta);
                            newMoovView.setUint32(scanPos + 16 + i * 8, Number(off / 4294967296n), false);
                            newMoovView.setUint32(scanPos + 20 + i * 8, Number(off % 4294967296n), false);
                        }
                    }
                    scanPos += 4;
                }
            }

            // Собираем итоговый файл
            const result = new Uint8Array(len + delta);
            result.set(u8.subarray(0, moovStart), 0);
            result.set(newMoovBytes, moovStart);
            result.set(u8.subarray(moovStart + moovLen), moovStart + newMoovLen);
            return result.buffer;
        } catch (e) {
            console.warn('[MOSSAD] injectMp4Metadata error:', e);
            return buffer;
        }
    }

    /**
     * Внедряет метаданные (промпт, ссылку, модель и хэш) в WebP файл (RIFF контейнер) через XMP чанк.
     */
    function injectWebpMetadata(buffer, prompt, url, model = '', promptHash = '') {
        try {
            const u8 = new Uint8Array(buffer);
            const view = new DataView(buffer);
            if (u8.length < 12) return buffer;
            // Проверка 'RIFF' и 'WEBP'
            const riff = String.fromCharCode(u8[0], u8[1], u8[2], u8[3]);
            const webp = String.fromCharCode(u8[8], u8[9], u8[10], u8[11]);
            if (riff !== 'RIFF' || webp !== 'WEBP') return buffer;

            const textEncoder = new TextEncoder();
            const escapeXml = (s) => (s || '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;' }[c]));
            const cleanXmlPrompt = escapeXml(prompt);
            const cleanXmlUrl = escapeXml(url);
            const cleanXmlModel = escapeXml(model || 'Grok');
            const cleanXmlTitle = escapeXml((prompt || '').slice(0, 60));
            const cleanXmlHash = escapeXml(promptHash);

            const xmpXml = `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:description><rdf:Alt><rdf:li xml:lang="x-default">${cleanXmlPrompt}</rdf:li></rdf:Alt></dc:description><dc:source>${cleanXmlUrl}</dc:source><dc:creator><rdf:Seq><rdf:li>${cleanXmlModel}</rdf:li></rdf:Seq></dc:creator><dc:title><rdf:Alt><rdf:li xml:lang="x-default">${cleanXmlTitle}</rdf:li></rdf:Alt></dc:title><dc:identifier>${cleanXmlHash}</dc:identifier></rdf:Description></rdf:RDF></x:xmpmeta>`;
            const xmpBytes = textEncoder.encode(xmpXml);

            // Чанк XMP в RIFF: 'XMP ' (4 байта) + 4 байта длина (little-endian) + данные + паддинг до четного
            const pad = (xmpBytes.length % 2 === 1) ? 1 : 0;
            const chunkLen = 8 + xmpBytes.length + pad;
            const xmpChunk = new Uint8Array(chunkLen);
            const chView = new DataView(xmpChunk.buffer);
            xmpChunk[0] = 0x58; xmpChunk[1] = 0x4D; xmpChunk[2] = 0x50; xmpChunk[3] = 0x20; // 'XMP '
            chView.setUint32(4, xmpBytes.length, true); // little-endian
            xmpChunk.set(xmpBytes, 8);

            const result = new Uint8Array(u8.length + chunkLen);
            result.set(u8, 0);
            result.set(xmpChunk, u8.length);

            // Обновляем размер RIFF в заголовке (offset 4, 4 байта little-endian = размер_файла - 8)
            const resView = new DataView(result.buffer);
            resView.setUint32(4, result.length - 8, true);
            return result.buffer;
        } catch (e) {
            console.warn('[MOSSAD] injectWebpMetadata error:', e);
            return buffer;
        }
    }

    /**
     * Главная точка входа: определяет тип медиа и внедряет метаданные (промпт, URL, модель, хэш).
     * @param {Blob} rawBlob
     * @param {string} prompt
     * @param {string} url
     * @param {string} model
     * @param {string} promptHash
     * @returns {Promise<Blob>}
     */
    async function injectGrokMetadataToBlob(rawBlob, prompt, url, model = '', promptHash = '') {
        if (!rawBlob) return rawBlob;
        const cleanPrompt = (prompt || '').trim();
        const cleanUrl = (url || location.href || '').trim();
        if (!cleanPrompt && !cleanUrl && !model) return rawBlob;

        try {
            const arrayBuffer = await rawBlob.arrayBuffer();
            const u8 = new Uint8Array(arrayBuffer);
            if (u8.length < 12) return rawBlob;

            let enrichedBuffer = arrayBuffer;

            // 1. Проверка MP4 (байты 4..7 === 'ftyp')
            if (u8[4] === 0x66 && u8[5] === 0x74 && u8[6] === 0x79 && u8[7] === 0x70) {
                enrichedBuffer = injectMp4Metadata(arrayBuffer, cleanPrompt, cleanUrl, model, promptHash);
            }
            // 2. Проверка PNG (сигнатура 89 50 4E 47)
            else if (u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4E && u8[3] === 0x47) {
                enrichedBuffer = injectPngMetadata(arrayBuffer, cleanPrompt, cleanUrl, model, promptHash);
            }
            // 3. Проверка JPEG (FF D8)
            else if (u8[0] === 0xFF && u8[1] === 0xD8) {
                enrichedBuffer = injectJpegMetadata(arrayBuffer, cleanPrompt, cleanUrl, model, promptHash);
            }
            // 4. Проверка WebP (RIFF....WEBP)
            else if (u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46 &&
                     u8[8] === 0x57 && u8[9] === 0x45 && u8[10] === 0x42 && u8[11] === 0x50) {
                enrichedBuffer = injectWebpMetadata(arrayBuffer, cleanPrompt, cleanUrl, model, promptHash);
            }

            return new Blob([enrichedBuffer], { type: rawBlob.type || 'application/octet-stream' });
        } catch (err) {
            console.warn('[MOSSAD] injectGrokMetadataToBlob error:', err);
            return rawBlob;
        }
    }

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadStoreConfig } = require('./store-config');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const DISK_EXT = new Set([...IMAGE_EXT, '.mp4']);
const PROTECTED_FILES = new Set(['logo.jpg', 'herovideo.mp4']);

function normalizeFilename(name) {
    return String(name || '').trim().toLowerCase();
}

function extractUploadFilenames(imagenUrl) {
    if (!imagenUrl) return [];
    const raw = Array.isArray(imagenUrl) ? imagenUrl.join(',') : String(imagenUrl);
    return raw.split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => {
            const idx = s.indexOf('/uploads/');
            const rel = idx !== -1 ? s.substring(idx) : s;
            return path.basename(rel);
        });
}

function getConfigReferencedFilenames() {
    const filenames = new Set(PROTECTED_FILES);
    const config = loadStoreConfig();
    const urls = [
        config.logoUrl,
        config.heroVideoUrl,
        config.featuredVideoUrl,
        ...(config.showcaseImages || []),
    ].filter(Boolean);

    for (const url of urls) {
        extractUploadFilenames(url).forEach(f => filenames.add(f));
    }

    return filenames;
}

function isProtectedUpload(filename) {
    if (!filename) return true;
    const normalized = normalizeFilename(filename);
    for (const protectedName of PROTECTED_FILES) {
        if (normalizeFilename(protectedName) === normalized) return true;
    }
    for (const protectedName of getConfigReferencedFilenames()) {
        if (normalizeFilename(protectedName) === normalized) return true;
    }
    return false;
}

function deleteUploadFiles(imagenUrl) {
    const deleted = [];
    const failed = [];
    for (const filename of extractUploadFilenames(imagenUrl)) {
        if (isProtectedUpload(filename)) continue;
        const filePath = path.join(UPLOADS_DIR, filename);
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                deleted.push(filename);
            }
        } catch (err) {
            failed.push({ filename, error: err.message });
        }
    }
    return { deleted, failed };
}

function listDiskFiles() {
    if (!fs.existsSync(UPLOADS_DIR)) return [];
    return fs.readdirSync(UPLOADS_DIR)
        .filter(name => DISK_EXT.has(path.extname(name).toLowerCase()))
        .map(name => {
            const filePath = path.join(UPLOADS_DIR, name);
            const stat = fs.statSync(filePath);
            return { filename: name, sizeBytes: stat.size, mtime: stat.mtime };
        });
}

function hashFile(filePath) {
    const buf = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(buf).digest('hex');
}

function isProductVisibleOnWeb(product) {
    return Number(product.cantidad) > 0;
}

function dedupeFilenameList(filenames) {
    const seen = new Set();
    const out = [];
    for (const f of filenames) {
        if (!seen.has(f)) {
            seen.add(f);
            out.push(f);
        }
    }
    return out;
}

function filenamesToImagenUrl(filenames) {
    if (!filenames.length) return null;
    return filenames.map(f => `/uploads/${f}`).join(',');
}

async function buildReferenceIndex(pool) {
    const result = await pool.query(`
        SELECT codigo, nombre, imagen_url, cantidad, area_encargada
        FROM productos
        WHERE imagen_url IS NOT NULL AND TRIM(imagen_url) != ''
    `);

    const byFilename = new Map();
    const products = [];

    for (const row of result.rows) {
        const files = extractUploadFilenames(row.imagen_url);
        const uniqueFiles = [...new Set(files)];
        const hasDupRefs = uniqueFiles.length !== files.length;

        products.push({
            codigo: row.codigo,
            nombre: row.nombre,
            cantidad: row.cantidad,
            area_encargada: row.area_encargada,
            imagen_url: row.imagen_url,
            files,
            hasDupRefs,
        });

        for (const filename of files) {
            if (!byFilename.has(filename)) byFilename.set(filename, []);
            byFilename.get(filename).push({ codigo: row.codigo, nombre: row.nombre });
        }
    }

    return { products, byFilename };
}

function productNotWebReason(p) {
    if (Number(p.cantidad) <= 0) return 'Sin stock';
    return 'No visible en tienda';
}

async function scanUploads(pool) {
    const diskFiles = listDiskFiles();
    const { products, byFilename } = await buildReferenceIndex(pool);
    const configProtected = getConfigReferencedFilenames();

    const referenced = new Set([...byFilename.keys(), ...configProtected]);
    const orphans = diskFiles.filter(f => !isProtectedUpload(f.filename) && !referenced.has(f.filename));

    const notInWeb = products.filter(p => !isProductVisibleOnWeb(p));
    const dupRefs = products.filter(p => p.hasDupRefs);

    const hashGroups = new Map();
    for (const file of diskFiles) {
        if (!IMAGE_EXT.has(path.extname(file.filename).toLowerCase())) continue;
        try {
            const hash = hashFile(path.join(UPLOADS_DIR, file.filename));
            if (!hashGroups.has(hash)) hashGroups.set(hash, []);
            hashGroups.get(hash).push(file);
        } catch {
            /* skip unreadable */
        }
    }

    const duplicateContent = [];
    for (const [hash, files] of hashGroups.entries()) {
        if (files.length < 2) continue;
        duplicateContent.push({
            hash,
            files: files.map(f => ({
                filename: f.filename,
                sizeBytes: f.sizeBytes,
                referencedBy: byFilename.get(f.filename) || [],
            })),
        });
    }

    const orphanBytes = orphans.reduce((acc, f) => acc + f.sizeBytes, 0);
    const notInWebFileCount = notInWeb.reduce((acc, p) => acc + p.files.length, 0);

    return {
        disk: {
            totalFiles: diskFiles.length,
            totalBytes: diskFiles.reduce((acc, f) => acc + f.sizeBytes, 0),
            orphans: orphans.map(f => ({ filename: f.filename, sizeBytes: f.sizeBytes })),
        },
        products: {
            withPhotos: products.length,
            notInWeb: notInWeb.map(p => ({
                codigo: p.codigo,
                nombre: p.nombre,
                reason: productNotWebReason(p),
                fileCount: p.files.length,
            })),
            duplicateRefs: dupRefs.map(p => ({
                codigo: p.codigo,
                nombre: p.nombre,
                fileCount: p.files.length,
            })),
        },
        duplicateContent,
        summary: {
            orphanCount: orphans.length,
            orphanBytes,
            notInWebProductCount: notInWeb.length,
            notInWebFileCount,
            duplicateRefProductCount: dupRefs.length,
            duplicateContentGroups: duplicateContent.length,
            duplicateContentExtraFiles: duplicateContent.reduce((acc, g) => acc + g.files.length - 1, 0),
            configProtectedCount: configProtected.size,
        },
    };
}

async function runCleanup(pool, action) {
    const result = {
        action,
        filesDeleted: 0,
        productsUpdated: 0,
        refsMerged: 0,
        failedFiles: [],
    };

    if (action === 'orphans') {
        const scan = await scanUploads(pool);
        for (const orphan of scan.disk.orphans) {
            if (isProtectedUpload(orphan.filename)) continue;
            try {
                fs.unlinkSync(path.join(UPLOADS_DIR, orphan.filename));
                result.filesDeleted++;
            } catch (err) {
                result.failedFiles.push({ filename: orphan.filename, error: err.message });
            }
        }
        result.message = `${result.filesDeleted} archivo(s) huérfano(s) eliminado(s) del servidor.`;
        return result;
    }

    if (action === 'dedupe-refs') {
        const { products } = await buildReferenceIndex(pool);
        for (const p of products) {
            if (!p.hasDupRefs) continue;
            const deduped = dedupeFilenameList(p.files);
            const newUrl = filenamesToImagenUrl(deduped);
            await pool.query('UPDATE productos SET imagen_url = $1 WHERE codigo = $2', [newUrl, p.codigo]);
            result.productsUpdated++;
        }
        result.message = `Referencias duplicadas corregidas en ${result.productsUpdated} producto(s).`;
        return result;
    }

    if (action === 'duplicate-files') {
        const scan = await scanUploads(pool);
        const replaceMap = new Map();

        for (const group of scan.duplicateContent) {
            const files = group.files;
            const referenced = files.filter(f => f.referencedBy.length > 0);
            const keeper = referenced[0]?.filename || files[0].filename;
            for (const file of files) {
                if (file.filename !== keeper && !isProtectedUpload(file.filename)) {
                    replaceMap.set(file.filename, keeper);
                }
            }
        }

        const allWithPhotos = await pool.query(`
            SELECT codigo, imagen_url FROM productos
            WHERE imagen_url IS NOT NULL AND TRIM(imagen_url) != ''
        `);

        for (const row of allWithPhotos.rows) {
            const original = extractUploadFilenames(row.imagen_url);
            const replaced = dedupeFilenameList(
                original.map(f => replaceMap.get(f) || f)
            );
            const changed = replaced.length !== original.length
                || replaced.some((f, i) => f !== original[i]);
            if (!changed) continue;

            await pool.query(
                'UPDATE productos SET imagen_url = $1 WHERE codigo = $2',
                [filenamesToImagenUrl(replaced), row.codigo]
            );
            result.productsUpdated++;
            result.refsMerged += original.length - replaced.length;
        }

        for (const duplicate of replaceMap.keys()) {
            if (isProtectedUpload(duplicate)) continue;
            const filePath = path.join(UPLOADS_DIR, duplicate);
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    result.filesDeleted++;
                }
            } catch (err) {
                result.failedFiles.push({ filename: duplicate, error: err.message });
            }
        }

        result.message = `Duplicados por contenido: ${result.filesDeleted} archivo(s) eliminado(s), referencias actualizadas en ${result.productsUpdated} producto(s).`;
        return result;
    }

    if (action === 'not-in-web' || action === 'inactive') {
        const { products } = await buildReferenceIndex(pool);
        const targets = products.filter(p => !isProductVisibleOnWeb(p));

        for (const p of targets) {
            const { deleted, failed } = deleteUploadFiles(p.imagen_url);
            result.filesDeleted += deleted.length;
            result.failedFiles.push(...failed);
            await pool.query('UPDATE productos SET imagen_url = NULL WHERE codigo = $1', [p.codigo]);
            result.productsUpdated++;
        }

        result.message = action === 'inactive'
            ? `Fotos eliminadas de ${result.productsUpdated} producto(s) sin stock.`
            : `Fotos eliminadas de ${result.productsUpdated} producto(s) no visibles en la tienda (sin stock).`;
        return result;
    }

    throw new Error('Acción de limpieza no válida');
}

module.exports = {
    UPLOADS_DIR,
    extractUploadFilenames,
    deleteUploadFiles,
    scanUploads,
    runCleanup,
    isProductVisibleOnWeb,
};

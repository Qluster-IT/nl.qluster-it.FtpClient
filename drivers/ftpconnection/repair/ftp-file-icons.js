'use strict';

(function () {
	const categories = [
		['audio', 'audio.png', 'aac ac3 aif aiff alac amr ape flac m4a mid midi mka mp3 oga ogg opus wav wma'],
		['video', 'video.png', '3g2 3gp avi flv m2ts m2v m4v mkv mov mp4 mpe mpeg mpg mts ogv vob webm wmv'],
		['image', 'image.png', 'ai avif bmp dng eps gif heic heif ico jfif jpeg jpg png psd raw svg tif tiff webp'],
		['archive', 'zip.png', '7z ace arj bz bz2 cab dmg gz gzip iso jar lz lzh lzma rar tar tbz tbz2 tgz txz xz z zip zst zstd'],
		['word', 'doc.png', 'doc docm docx dot dotm dotx gdoc odt ott pages rtf'],
		['excel', 'xls.png', 'gsheet numbers ods ots xls xlsb xlsm xlsx xlt xltm xltx'],
		['powerpoint', 'ppt.png', 'gslides key odp otp pot potm potx pps ppsm ppsx ppt pptm pptx'],
		['code', 'xml.png', 'bash bashrc bat c cc cfg clj cljs cmd conf config cpp cs csh css cxx dart editorconfig env erl ex exs fish gitattributes gitignore go gradle h hpp hrl hs htm html ini java js json jsonc jsx kt kts less lisp lua m mm npmrc php phtml pl pm ps1 psd1 psm1 py pyw r rb rs sass scala scss sh sql svelte swift toml ts tsx vb vue wasm xhtml xml yaml yml zsh zshrc'],
		['csv', 'file-csv.svg', 'csv tsv'],
		['alt', 'txt.png', 'adoc ass changelog eml ical icalendar ics license log markdown md mbox msg nfo readme rst srt sub tex text txt vcard vcf vtt'],
		['pdf', 'pdf.png', 'pdf'],
		['signature', 'file-signature.svg', 'p7s sig signature'],
		['medical', 'file-medical.svg', 'dcm dicom']
	];
	const fallback = { glyph: 'fa-file', image: 'file.png' };
	const byExtension = new Map();
	for (const [category, image, extensions] of categories) {
		const icon = { glyph: `fa-file-${category}`, image };
		for (const extension of extensions.split(' ')) byExtension.set(extension, icon);
	}

	// Dedicated artwork takes priority over a broader file category.
	for (const extension of ('3gp ace arj asf asp avi bin bmp cab cda cgi chm config cur doc eps flv gif htm icns ico jpg jsp ' +
		'lzw mov mp3 mpg pdf pcx php png ppt psd ram rar rm rmvb rtf swf tag tga tif tmp txt vml vob wav wma wmv xls xml zip').split(' ')) {
		byExtension.set(extension, { label: extension === 'config' ? 'CFG' : extension.toUpperCase(), image: `${extension}.png` });
	}
	for (const [extension, artwork] of Object.entries({
		aspx: 'asp', cfg: 'config', docx: 'doc', html: 'htm', jpeg: 'jpg', mpeg: 'mpg', pptx: 'ppt', tiff: 'tif', xlsx: 'xls'
	})) {
		byExtension.set(extension, { label: extension.toUpperCase(), image: byExtension.get(artwork).image });
	}

	function getFileIcon(name) {
		const filename = name.slice(name.lastIndexOf('/') + 1);
		const extension = filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
		return byExtension.get(extension) || fallback;
	}

	if (typeof module === 'object' && module.exports) module.exports = getFileIcon;
	else window.getFtpFileIcon = getFileIcon;
})();

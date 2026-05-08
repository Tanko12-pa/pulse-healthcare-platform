import React, { useState, useEffect } from 'react';
import { 
  FolderOpen, 
  Search, 
  Filter, 
  Plus, 
  File, 
  Download, 
  Trash2, 
  X,
  FileText,
  Image as ImageIcon,
  FileCode,
  MoreVertical,
  Upload,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc,
  query,
  where,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PatientFile } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

interface PatientFilesProps {
  userId: string;
  isAdmin: boolean;
}

export default function PatientFiles({ userId, isAdmin }: PatientFilesProps) {
  const [files, setFiles] = useState<PatientFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Form State
  const [fileName, setFileName] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [fileType, setFileType] = useState('PDF');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const q = isAdmin 
      ? query(collection(db, 'files'), orderBy('uploadedAt', 'desc'))
      : query(collection(db, 'files'), where('patientId', '==', userId), orderBy('uploadedAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const patientFiles = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as PatientFile));
      setFiles(patientFiles);
      setIsLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'files'));

    return () => unsubscribe();
  }, [userId, isAdmin]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName || !fileUrl) return;
    
    setIsUploading(true);
    try {
      await addDoc(collection(db, 'files'), {
        patientId: userId,
        name: fileName,
        url: fileUrl,
        type: fileType,
        size: Math.floor(Math.random() * 5000000) + 100000, // Mock size
        uploadedAt: serverTimestamp()
      });
      
      setIsUploadOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'files');
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setFileName('');
    setFileUrl('');
    setFileType('PDF');
  };

  const handleFileSelect = async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    
    const file = selectedFiles[0];
    setFileName(file.name);
    setFileType(file.type.split('/')[1]?.toUpperCase() || 'OTHER');
    // In a real app, we would upload to Firebase Storage here
    // For now, we'll use a mock URL
    setFileUrl(`https://firebasestorage.googleapis.com/v0/b/pulse-healthcare/o/${encodeURIComponent(file.name)}?alt=media`);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this file?')) {
      try {
        await deleteDoc(doc(db, 'files', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'files');
      }
    }
  };

  const getFileIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('pdf')) return <FileText size={24} className="text-rose-500" />;
    if (t.includes('jpg') || t.includes('png') || t.includes('image')) return <ImageIcon size={24} className="text-blue-500" />;
    if (t.includes('doc')) return <File size={24} className="text-indigo-500" />;
    return <File size={24} className="text-slate-400" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredFiles = files.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">Patient's Files</h2>
          <p className="text-slate-500 font-medium">Access and manage your medical documents and shared files.</p>
        </div>
        
        <button 
          onClick={() => setIsUploadOpen(true)}
          className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center gap-2"
        >
          <Upload size={20} />
          Upload New File
        </button>
      </header>

      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4 flex-1">
          <Search size={18} className="text-slate-400" />
          <input 
            type="text" 
            placeholder="Search files by name..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-sm w-full font-medium"
          />
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 rounded-xl transition-all text-slate-500 font-bold text-xs">
            <Filter size={16} />
            Filter
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="col-span-full text-center py-20 bg-white rounded-[40px] border border-slate-50 shadow-sm">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
              <FolderOpen size={40} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No files found</h3>
            <p className="text-slate-500 text-sm">Upload your first file to get started.</p>
          </div>
        ) : (
          filteredFiles.map((file) => (
            <motion.div 
              key={file.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-6 rounded-3xl border border-slate-50 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-blue-50 transition-all">
                  {getFileIcon(file.type)}
                </div>
                <div className="flex gap-1">
                  <a 
                    href={file.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-slate-50 rounded-xl transition-all text-slate-400 hover:text-blue-600"
                  >
                    <Download size={18} />
                  </a>
                  <button 
                    onClick={() => handleDelete(file.id)}
                    className="p-2 hover:bg-slate-50 rounded-xl transition-all text-slate-400 hover:text-red-600"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 truncate" title={file.name}>{file.name}</h4>
                <div className="flex items-center gap-2 text-xs text-slate-400 font-bold uppercase tracking-widest">
                  <span>{file.type}</span>
                  <span>•</span>
                  <span>{formatSize(file.size)}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {file.uploadedAt?.toDate ? file.uploadedAt.toDate().toLocaleDateString() : 'Just now'}
                </span>
                <button className="text-blue-600 font-bold text-xs hover:underline">
                  View File
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {isUploadOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsUploadOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                <h3 className="text-2xl font-bold text-slate-900">Upload File</h3>
                <button 
                  onClick={() => setIsUploadOpen(false)}
                  className="p-2 hover:bg-slate-50 rounded-xl transition-all text-slate-400"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleUpload} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">File Name</label>
                  <input 
                    required
                    type="text"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    placeholder="e.g. Blood Test Results 2024"
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">File URL (Mock)</label>
                  <input 
                    required
                    type="text"
                    value={fileUrl}
                    onChange={(e) => setFileUrl(e.target.value)}
                    placeholder="https://example.com/file.pdf"
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">File Type</label>
                  <select 
                    value={fileType}
                    onChange={(e) => setFileType(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600/20 transition-all appearance-none"
                  >
                    <option value="PDF">PDF Document</option>
                    <option value="JPG">Image (JPG)</option>
                    <option value="PNG">Image (PNG)</option>
                    <option value="DOCX">Word Document</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div 
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  onClick={() => document.getElementById('file-input')?.click()}
                  className={`p-8 border-2 border-dashed rounded-[32px] text-center space-y-2 cursor-pointer transition-all ${
                    isDragging ? 'border-blue-600 bg-blue-50' : 'border-slate-100 hover:border-blue-200 hover:bg-slate-50'
                  }`}
                >
                  <input 
                    id="file-input"
                    type="file"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files)}
                  />
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto transition-all ${
                    isDragging ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400'
                  }`}>
                    {isUploading ? <Loader2 className="animate-spin" size={24} /> : <Upload size={24} />}
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    {fileName ? `Selected: ${fileName}` : 'Drag & drop files here'}
                  </p>
                  <p className="text-xs text-slate-400 font-medium">
                    {fileName ? 'Click to change file' : 'or click to browse from your computer'}
                  </p>
                </div>

                <button 
                  type="submit"
                  disabled={isUploading || !fileName}
                  className="w-full py-5 bg-blue-600 text-white rounded-3xl font-bold text-lg hover:bg-blue-700 transition-all shadow-2xl shadow-blue-100 mt-4 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isUploading && <Loader2 className="animate-spin" size={20} />}
                  {isUploading ? 'Uploading...' : 'Upload File'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

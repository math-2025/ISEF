

"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Label } from './ui/label';
import { Map, Shield, Target, Upload, Bot, Trash2, Edit, KeyRound, Pen, Eraser, Minus, Move, Waypoints } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth-provider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { collection, query, where, doc, getDocs, writeBatch } from 'firebase/firestore';
import type { MilitaryUnit, OperationTarget, Decoy, TacticalIconOnMap } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { encryptCoordinates, decryptCoordinates, type DerivationStep } from '@/lib/encryption';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { TacticalIcon } from './tactical-icons-palette';
import { cn } from '@/lib/utils';
import { Slider } from './ui/slider';

type ClickCoordinates = {
    x: number;
    y: number;
} | null;

const SINGLE_MAP_ID = 'main';

const drawingColors = [
    { name: 'Red', value: '#ef4444' },
    { name: 'Yellow', value: '#eab308' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'White', value: '#ffffff' },
];

const KEYBOARD_MOVE_AMOUNT = 0.5; // Percentage to move

export default function MapPlaceholder() {
  const { user } = useAuth();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const isCommander = user?.role === 'commander';
  
  const mapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mapUrl, setMapUrl] = useState(PlaceHolderImages.find(img => img.id === 'azerbaijan-map')?.imageUrl ?? PlaceHolderImages[0].imageUrl);
  const [tempMapUrl, setTempMapUrl] = useState('');
  const [isMapImportOpen, setIsMapImportOpen] = useState(false);
  const [isEncrypting, setIsEncrypting] = useState(false);

  // Drawing state
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokeColor, setStrokeColor] = useState('#ef4444');
  const [isErasing, setIsErasing] = useState(false);
  const [brushSize, setBrushSize] = useState(3);
  const [eraserSize, setEraserSize] = useState(20);


  // State for the new/edit target dialog
  const [isTargetDialogOpen, setIsTargetDialogOpen] = useState(false);
  const [targetCoordinates, setTargetCoordinates] = useState<ClickCoordinates>(null);
  const [targetName, setTargetName] = useState('');
  const [assignedUnitId, setAssignedUnitId] = useState('');
  const [targetStatus, setTargetStatus] = useState<OperationTarget['status']>('pending');
  const [editingTarget, setEditingTarget] = useState<OperationTarget | null>(null);

  // State for delete confirmation dialog
  const [targetToDelete, setTargetToDelete] = useState<OperationTarget | null>(null);
  const [isClearAllDialogOpen, setIsClearAllDialogOpen] = useState(false);
  const [tacticalIconToDelete, setTacticalIconToDelete] = useState<TacticalIconOnMap | null>(null);
  
  const [draggingIconId, setDraggingIconId] = useState<string | null>(null);
  const [selectedIconId, setSelectedIconId] = useState<string | null>(null);


  // State for encryption/decryption
  const [isEncryptDialogOpen, setIsEncryptDialogOpen] = useState(false);
  const [isDecryptDialogOpen, setIsDecryptDialogOpen] = useState(false);
  const [decoyToDecrypt, setDecoyToDecrypt] = useState<Decoy | null>(null);
  const [encryptionKey, setEncryptionKey] = useState('');
  const [decryptionKey, setDecryptionKey] = useState('');
  const [decryptionResult, setDecryptionResult] = useState<{ lat: number, lng: number} | string | null>(null);
  const [showDecryptionLog, setShowDecryptionLog] = useState(false);

  
  const decoysQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'decoys');
  }, [firestore]);
  const { data: decoys, isLoading: isLoadingDecoys } = useCollection<Decoy>(decoysQuery);

  const unitsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    const q = collection(firestore, 'military_units');

    if (user.role === 'sub-commander' && !user.canSeeAllUnits && user.assignedUnitId) {
        return query(q, where('id', '==', user.assignedUnitId));
    }
    return q;
  }, [firestore, user]);

  const { data: units, isLoading: isLoadingUnits } = useCollection<MilitaryUnit>(unitsQuery);

  const targetsBaseQuery = useMemoFirebase(() => {
      if (!firestore || !user) return null;
      return collection(firestore, 'operation_targets');
  }, [firestore, user]);
  
  const targetsQuery = useMemoFirebase(() => {
      if (!targetsBaseQuery) return null;
      if (user?.role === 'sub-commander' && !user.canSeeAllUnits && user.assignedUnitId) {
          return query(targetsBaseQuery, where('assignedUnitId', '==', user.assignedUnitId));
      }
      return targetsBaseQuery;
  }, [targetsBaseQuery, user]);

  const { data: targets, isLoading: isLoadingTargets } = useCollection<OperationTarget>(targetsQuery);
  
  const tacticalIconsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'tactical_icons');
  }, [firestore]);
  const { data: tacticalIcons, isLoading: isLoadingTacticalIcons } = useCollection<TacticalIconOnMap>(tacticalIconsQuery);


  useEffect(() => {
    const defaultMap = PlaceHolderImages.find(img => img.id === 'azerbaijan-map')?.imageUrl;
    const storedMapUrl = localStorage.getItem('mainMapUrl') || defaultMap;
    if (storedMapUrl) {
      setMapUrl(storedMapUrl);
    }
  }, []);
  
  // Canvas resizing
  useEffect(() => {
    const canvas = canvasRef.current;
    const map = mapRef.current;
    if (canvas && map) {
      const resizeObserver = new ResizeObserver(() => {
        // Save current canvas content
        const currentDrawing = canvas.toDataURL();
        
        canvas.width = map.clientWidth;
        canvas.height = map.clientHeight;

        // Restore canvas content
        const ctx = canvas.getContext('2d');
        if (ctx) {
            const img = new window.Image();
            img.src = currentDrawing;
            img.onload = () => {
                ctx.drawImage(img, 0, 0);
            }
        }
      });
      resizeObserver.observe(map);
      return () => resizeObserver.disconnect();
    }
  }, []);

  // Keyboard controls for moving icons
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (!selectedIconId || !firestore || !tacticalIcons) return;

        const icon = tacticalIcons.find(i => i.id === selectedIconId);
        if (!icon) return;

        let newLat = icon.latitude;
        let newLng = icon.longitude;

        switch(e.key.toLowerCase()) {
            case 'w': newLat -= KEYBOARD_MOVE_AMOUNT; break;
            case 's': newLat += KEYBOARD_MOVE_AMOUNT; break;
            case 'a': newLng -= KEYBOARD_MOVE_AMOUNT; break;
            case 'd': newLng += KEYBOARD_MOVE_AMOUNT; break;
            default: return; // Not a movement key
        }
        
        e.preventDefault(); // Prevent page scrolling
        
        // Clamp values between 0 and 100
        newLat = Math.max(0, Math.min(100, newLat));
        newLng = Math.max(0, Math.min(100, newLng));
        
        const iconDocRef = doc(firestore, 'tactical_icons', selectedIconId);
        updateDocumentNonBlocking(iconDocRef, { latitude: newLat, longitude: newLng });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIconId, firestore, tacticalIcons]);


  const getCoords = (e: MouseEvent | TouchEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
        x: clientX - rect.left,
        y: clientY - rect.top,
    };
  };

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingMode) return;
    const coords = getCoords(e.nativeEvent);
    if (!coords) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    
    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  }, [isDrawingMode]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !isDrawingMode) return;
    e.preventDefault(); 
    e.stopPropagation();

    const coords = getCoords(e.nativeEvent);
    if (!coords) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    
    if (isErasing) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = eraserSize;
    } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = brushSize;
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  }, [isDrawing, isDrawingMode, strokeColor, isErasing, brushSize, eraserSize]);
  
  const endDrawing = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.closePath();
    setIsDrawing(false);
  }, []);

  const handleSaveCustomMap = () => {
    if (tempMapUrl) {
      setMapUrl(tempMapUrl);
      localStorage.setItem('mainMapUrl', tempMapUrl);
      setIsMapImportOpen(false);
      setTempMapUrl('');
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!mapRef.current || !firestore) return;

    const mapRect = mapRef.current.getBoundingClientRect();
    const x = ((e.clientX - mapRect.left) / mapRect.width) * 100;
    const y = ((e.clientY - mapRect.top) / mapRect.height) * 100;

    // Handle dropping a new icon from the palette
    const newIconData = e.dataTransfer.getData('application/json');
    if (newIconData) {
        if (isDrawingMode) return;
        const iconData = JSON.parse(newIconData);
        const newIcon: TacticalIconOnMap = {
            id: uuidv4(),
            type: iconData.type,
            label: iconData.label,
            latitude: y,
            longitude: x,
            mapId: SINGLE_MAP_ID
        };
        const iconDocRef = doc(firestore, 'tactical_icons', newIcon.id);
        setDocumentNonBlocking(iconDocRef, newIcon);
        toast({
            title: "Nişan Əlavə Edildi",
            description: `Xəritəyə yeni bir "${iconData.label}" nişanı əlavə edildi.`
        });
        return;
    }

    // Handle moving an existing icon on the map
    const movedIconId = e.dataTransfer.getData('text/plain');
    if (movedIconId && tacticalIcons?.find(i => i.id === movedIconId)) {
        const iconDocRef = doc(firestore, 'tactical_icons', movedIconId);
        updateDocumentNonBlocking(iconDocRef, { latitude: y, longitude: x });
        setDraggingIconId(null);
    }
  };

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Deselect icon if clicking on map background
    if (!(e.target as HTMLElement).closest('[data-interactive]')) {
        setSelectedIconId(null);
    }

    if (!isCommander || isDrawingMode) return;
    
    if ((e.target as HTMLElement).closest('[data-interactive]')) {
      return;
    }
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    setTargetCoordinates({ x, y });
    setEditingTarget(null);
    setTargetName('');
    setAssignedUnitId('');
    setTargetStatus('pending');
    setIsTargetDialogOpen(true);
  };

  const handleSaveTarget = () => {
    if (!targetName || !assignedUnitId || !firestore) {
         toast({
            variant: "destructive",
            title: "Xəta",
            description: "Hədəf adı və bölük seçilməlidir.",
        });
        return;
    }
    
    if (editingTarget) {
      // Update existing target
      const targetDocRef = doc(firestore, 'operation_targets', editingTarget.id);
      const updatedData: Partial<OperationTarget> = {
        name: targetName,
        assignedUnitId: assignedUnitId,
        status: targetStatus,
      };
      setDocumentNonBlocking(targetDocRef, updatedData, { merge: true });


      toast({
        title: "Hədəf Yeniləndi",
        description: `"${targetName}" adlı hədəf məlumatları yeniləndi.`
      });
    } else if (targetCoordinates) {
      // Create new target
       const newTarget: OperationTarget = {
          id: uuidv4(),
          name: targetName,
          assignedUnitId: assignedUnitId,
          latitude: targetCoordinates.y,
          longitude: targetCoordinates.x,
          status: targetStatus,
          mapId: SINGLE_MAP_ID,
      };
      
      const targetDocRef = doc(firestore, 'operation_targets', newTarget.id);
      setDocumentNonBlocking(targetDocRef, newTarget);

      toast({
          title: "Hədəf Yaradıldı",
          description: `"${targetName}" adlı yeni hədəf yaradıldı və "${units?.find(u => u.id === assignedUnitId)?.name}" bölüyünə təyin edildi.`
      });
    }

    setIsTargetDialogOpen(false);
    setEditingTarget(null);
    setTargetName('');
    setAssignedUnitId('');
    setTargetCoordinates(null);
    setTargetStatus('pending');
  };

  const handleOpenEncryptDialog = () => {
    if (!targets) return;
    const activeTargets = targets.filter(t => t.status === 'active');
    if (activeTargets.length === 0) {
        toast({
            title: "Aktiv Hədəf Yoxdur",
            description: "Şifrələmə üçün ən az bir 'aktiv' statuslu hədəf olmalıdır.",
        });
        return;
    }
    setIsEncryptDialogOpen(true);
  }
  
  const handleStartEncryption = async () => {
    if (!firestore || !targets || !encryptionKey) {
        toast({ title: "Xəta", description: "Açar söz daxil edilməlidir.", variant: "destructive" });
        return;
    };

    const activeTargets = targets.filter(t => t.status === 'active');
    
    setIsEncrypting(true);
    setIsEncryptDialogOpen(false);

    toast({
      title: 'Şifrələmə Başladı',
      description: `${activeTargets.length} aktiv hədəf üçün yem koordinatları yaradılır...`,
    });

    try {
        const oldDecoysQuery = collection(firestore, 'decoys');
        const oldDecoysSnapshot = await getDocs(oldDecoysQuery);
        const deleteBatch = writeBatch(firestore);
        oldDecoysSnapshot.forEach(doc => deleteBatch.delete(doc.ref));
        await deleteBatch.commit();
        
        const decoyPromises = activeTargets.map(async (target, index) => {
            const { encryptedLat, encryptedLng, derivationSteps } = encryptCoordinates(target.latitude, target.longitude, encryptionKey);
            
            const publicNames = ["Alfa", "Beta", "Gamma", "Delta", "Epsilon", "Zeta"];

            const newDecoy: Decoy = {
                id: uuidv4(),
                publicName: `Bölük ${publicNames[index % publicNames.length]}`,
                latitude: encryptedLat,
                longitude: encryptedLng,
                operationTargetId: target.id,
                derivationSteps: derivationSteps,
                originalLat: target.latitude,
                originalLng: target.longitude,
            };
            
            const decoyDocRef = doc(firestore, 'decoys', newDecoy.id);
            return setDocumentNonBlocking(decoyDocRef, newDecoy, { merge: false });
        });

        await Promise.all(decoyPromises);

        toast({
            title: 'Şifrələmə Uğurlu Oldu',
            description: `${activeTargets.length} yeni yem koordinatı yaradıldı və yayıma göndərildi.`,
        });

    } catch (error) {
        console.error('Error starting encryption:', error);
        toast({
            variant: 'destructive',
            title: 'Şifrələmə Xətası',
            description: 'Yem koordinatları yaradılarkən problem baş verdi.',
        });
    } finally {
      setIsEncrypting(false);
      setEncryptionKey('');
    }
  };
  
  const handleOpenDecryptDialog = (decoy: Decoy) => {
    setDecoyToDecrypt(decoy);
    setDecryptionResult(null);
    setDecryptionKey('');
    setShowDecryptionLog(false);
    setIsDecryptDialogOpen(true);
  }

  const handleDecryption = () => {
    if (!decoyToDecrypt || !decryptionKey) return;
    
    try {
        const { decryptedLat, decryptedLng } = decryptCoordinates(decoyToDecrypt.latitude, decoyToDecrypt.longitude, decryptionKey);

        const tolerance = 0.0001;
        if (Math.abs(decryptedLat - decoyToDecrypt.originalLat) < tolerance && Math.abs(decryptedLng - decoyToDecrypt.originalLng) < tolerance) {
            setDecryptionResult({ lat: decryptedLat, lng: decryptedLng });
            setShowDecryptionLog(true); // Show log on successful decryption
        } else {
            setDecryptionResult("Açar yanlışdır və ya deşifrələmə xətası baş verdi.");
            setShowDecryptionLog(false);
        }
    } catch (e) {
        setDecryptionResult("Deşifrələmə zamanı kritik xəta.");
        setShowDecryptionLog(false);
    }
  }


  const handleEditTargetClick = (target: OperationTarget) => {
    setEditingTarget(target);
    setTargetName(target.name);
    setAssignedUnitId(target.assignedUnitId);
    setTargetStatus(target.status);
    setTargetCoordinates(null); // Not changing coordinates on edit
    setIsTargetDialogOpen(true);
  };
  
  const handleDeleteTargetClick = (target: OperationTarget) => {
     setTargetToDelete(target);
  }

  const confirmDeleteTarget = async () => {
    if (!targetToDelete || !firestore) return;

    try {
        const targetDocRef = doc(firestore, 'operation_targets', targetToDelete.id);
        const batch = writeBatch(firestore);
        
        batch.delete(targetDocRef);
        
        const decoysQuerySnap = await getDocs(query(collection(firestore, 'decoys'), where('operationTargetId', '==', targetToDelete.id)));
        decoysQuerySnap.forEach(decoyDoc => batch.delete(decoyDoc.ref));

        await batch.commit();

        toast({
            title: "Hədəf Silindi",
            description: `"${targetToDelete.name}" adlı hədəf və əlaqəli yemlər silindi.`
        });
    } catch (error) {
        console.error("Error deleting target:", error);
        toast({
            variant: "destructive",
            title: "Silmə Xətası",
            description: "Hədəf silinərkən bir problem yarandı."
        });
    } finally {
        setTargetToDelete(null);
    }
  };

  const handleClearAllPointsAndDrawings = async () => {
    if (!firestore) return;

    const batch = writeBatch(firestore);
    
    try {
        const collectionsToClear = ['operation_targets', 'decoys', 'tactical_icons'];
        
        for (const collectionName of collectionsToClear) {
            const collectionRef = collection(firestore, collectionName);
            const snapshot = await getDocs(collectionRef);
            snapshot.forEach((doc) => {
                batch.delete(doc.ref);
            });
        }
        
        await batch.commit();
        
        // Also clear the canvas
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }

        toast({
            title: "Xəritə Təmizləndi",
            description: "Bütün hədəflər, yemlər, nişanlar və cizgilər xəritədən silindi."
        });

    } catch (error) {
        console.error("Error clearing all points:", error);
        toast({
            variant: "destructive",
            title: "Təmizləmə Xətası",
            description: "Xəritə təmizlənərkən bir problem yarandı."
        });
    } finally {
      setIsClearAllDialogOpen(false);
    }
  };

  const confirmDeleteTacticalIcon = () => {
    if (!tacticalIconToDelete || !firestore) return;

    const iconDocRef = doc(firestore, 'tactical_icons', tacticalIconToDelete.id);
    deleteDocumentNonBlocking(iconDocRef);

    toast({
        title: "Nişan Silindi",
        description: `"${tacticalIconToDelete.label}" nişanı xəritədən silindi.`
    });

    setTacticalIconToDelete(null);
    setSelectedIconId(null);
  };
  
  const handleCalculatePath = () => {
    const allHqs = tacticalIcons?.filter(icon => icon.type === 'hq') || [];
    const allObjectives = tacticalIcons?.filter(icon => icon.type === 'objective') || [];
    const canvas = canvasRef.current;
    const map = mapRef.current;

    if (allHqs.length === 0 || allObjectives.length === 0) {
        toast({
            title: "Nişanlar Tapılmadı",
            description: "Marşrutu hesablamaq üçün xəritədə ən az bir Qərargah və bir Hədəf (X) nişanı olmalıdır.",
            variant: "destructive",
        });
        return;
    }

    if (!canvas || !map) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const mapWidth = map.clientWidth;
    const mapHeight = map.clientHeight;

    // Clear previous paths by clearing the entire canvas for simplicity
    // A more advanced solution would use a separate layer for paths.
    // For now, this is acceptable. We will redraw other drawings if needed, but for now, we clear all.
    // Let's not clear for now, to avoid deleting tactical drawings. Paths will just draw over.

    let pathCount = 0;
    allHqs.forEach(hq => {
        allObjectives.forEach(objective => {
            const startX = (hq.longitude / 100) * mapWidth;
            const startY = (hq.latitude / 100) * mapHeight;
            const endX = (objective.longitude / 100) * mapWidth;
            const endY = (objective.latitude / 100) * mapHeight;

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            
            ctx.strokeStyle = '#eab308'; // Yellow color for the path
            ctx.lineWidth = 3;
            ctx.setLineDash([5, 5]);
            ctx.globalCompositeOperation = 'source-over';
            
            ctx.stroke();
            pathCount++;
        });
    });
    
    // Reset line dash for other drawings
    ctx.setLineDash([]);

    toast({
        title: "Əməliyyat Zəncirləri Hesablandı",
        description: `${pathCount} mümkün marşrut xəritədə göstərildi.`
    });
};


  const getTargetClasses = (status: OperationTarget['status']) => {
    switch (status) {
      case 'active':
        return 'text-green-500';
      case 'passive':
        return 'text-red-500';
      case 'pending':
      default:
        return 'text-blue-400';
    }
  };
  
  const renderDecryptionResult = () => {
      if (!decryptionResult || !decoyToDecrypt) return null;
      if (typeof decryptionResult === 'string') {
          return <p className="mt-4 text-destructive text-center font-semibold">{decryptionResult}</p>;
      }
      return (
          <div className="mt-4 p-4 rounded-md bg-green-900/50 border border-green-700 text-center space-y-3">
              <div>
                  <p className="font-bold text-green-300">Orijinal Koordinat (Deşifrələnmiş):</p>
                  <p className="font-mono text-lg text-white">{decryptionResult.lat.toFixed(6)}, {decryptionResult.lng.toFixed(6)}</p>
              </div>
              <div className="border-t border-green-700/50 pt-3">
                  <p className="font-bold text-red-300">Son Koordinat (Şifrələnmiş):</p>
                  <p className="font-mono text-lg text-white">{decoyToDecrypt.latitude.toFixed(6)}, {decoyToDecrypt.longitude.toFixed(6)}</p>
              </div>
          </div>
      )
  }

  return (
    <div className="h-screen w-full flex flex-col p-4 gap-4">
      <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Əməliyyat Xəritəsi</h1>
        <div className="flex items-center flex-wrap gap-2">
          {isCommander && (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsMapImportOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Xəritəni Dəyişdir
              </Button>
              <div className='flex items-center gap-2 bg-muted p-1 rounded-md border'>
                <Button variant={isDrawingMode ? "secondary" : "ghost"} size="sm" onClick={() => { setIsDrawingMode(!isDrawingMode); if (isDrawingMode) setIsErasing(false); }}>
                  <Pen className="mr-2 h-4 w-4" />
                  Taktiki Cizgi
                </Button>
                {isDrawingMode && (
                  <>
                  <Button variant={isErasing ? 'destructive' : 'ghost'} size="sm" onClick={() => setIsErasing(!isErasing)}>
                    <Eraser className="mr-2 h-4 w-4" />
                    Pozan
                  </Button>
                  
                  <div className='flex items-center gap-1 p-1 rounded-md bg-background/50 border'>
                    {isErasing ? (
                        <div className="flex items-center gap-2 px-2">
                            <Label htmlFor="eraser-size" className='text-xs'>Ölçü:</Label>
                            <Slider id="eraser-size" min={5} max={100} step={5} value={[eraserSize]} onValueChange={(val) => setEraserSize(val[0])} className="w-24" />
                        </div>
                    ) : (
                        <>
                        <div className="flex items-center gap-2 px-2">
                            <Label htmlFor="brush-size" className='text-xs'>Ölçü:</Label>
                            <Slider id="brush-size" min={1} max={20} step={1} value={[brushSize]} onValueChange={(val) => setBrushSize(val[0])} className="w-24" />
                        </div>
                        {drawingColors.map(color => (
                            <TooltipProvider key={color.value}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => setStrokeColor(color.value)}
                                        className={cn(
                                            "h-6 w-6 rounded-full border-2 transition-all",
                                            strokeColor === color.value ? 'border-ring' : 'border-transparent'
                                        )}
                                        style={{ backgroundColor: color.value }}
                                    />
                                </TooltipTrigger>
                                <TooltipContent><p>{color.name}</p></TooltipContent>
                            </Tooltip>
                            </TooltipProvider>
                        ))}
                        </>
                    )}
                  </div>

                  </>
                )}
              </div>
              <Button size="sm" onClick={handleCalculatePath}>
                <Waypoints className="mr-2 h-4 w-4" />
                Əməliyyat Zənciri Hesabla
              </Button>
              <Button size="sm" onClick={handleOpenEncryptDialog} disabled={isEncrypting}>
                <Bot className="mr-2 h-4 w-4" />
                {isEncrypting ? 'Şifrələnir...' : 'Koordinatları Şifrələ'}
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setIsClearAllDialogOpen(true)} disabled={isEncrypting}>
                <Minus className="mr-2 h-4 w-4" />
                Xəritəni Təmizlə
              </Button>
            </>
          )}
        </div>
      </div>
      <Card className="flex-grow w-full border-primary/20">
        <CardContent className="p-2 h-full">
          <TooltipProvider>
            <div 
              ref={mapRef}
              className={cn(
                "relative w-full h-full rounded-md overflow-hidden bg-muted",
                 isDrawingMode ? (isErasing ? "cursor-grab" : "cursor-crosshair") : "cursor-default",
              )}
              onClick={handleMapClick}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              tabIndex={0}
            >
              <Image
                src={mapUrl}
                alt="Ümumi əməliyyat xəritəsi"
                fill
                className="object-cover"
                unoptimized
              />
              <div className={cn('absolute inset-0', draggingIconId ? 'cursor-grabbing' : '')} style={{pointerEvents: isDrawingMode ? 'none' : 'auto'}}>
                {/* Render Tactical Icons */}
                {!isLoadingTacticalIcons && tacticalIcons?.map(icon => (
                  <div 
                    key={icon.id} 
                    className={cn(
                        "absolute p-1 rounded-md",
                        selectedIconId === icon.id && "bg-blue-500/50 ring-2 ring-blue-400"
                    )}
                    style={{ top: `${icon.latitude}%`, left: `${icon.longitude}%`, transform: 'translate(-50%, -50%)', cursor: isCommander ? 'pointer' : 'default' }}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (isCommander) {
                            setSelectedIconId(icon.id);
                        }
                    }}
                    draggable={isCommander}
                    onDragStart={(e) => {
                      if (!isCommander) return;
                      e.dataTransfer.setData('text/plain', icon.id);
                      e.dataTransfer.effectAllowed = 'move';
                      setDraggingIconId(icon.id);
                      const img = new window.Image();
                      img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                      e.dataTransfer.setDragImage(img, 0, 0);
                    }}
                    onDragEnd={() => setDraggingIconId(null)}
                    data-interactive
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className='focus:outline-none pointer-events-auto' onClick={(e) => e.stopPropagation()}>
                          <TacticalIcon type={icon.type} label={icon.label} isOnMap />
                        </button>
                      </DropdownMenuTrigger>
                       <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                         <DropdownMenuItem disabled>
                           <p className="font-semibold">{icon.label}</p>
                         </DropdownMenuItem>
                          {isCommander && (
                            <>
                            <DropdownMenuItem disabled>
                              <div className="flex items-center text-muted-foreground text-xs">
                                <Move size={12} className="mr-2"/> W/A/S/D ilə hərəkət etdir
                              </div>
                             </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setTacticalIconToDelete(icon)} className="text-destructive focus:text-destructive">
                              <Trash2 size={14} className="mr-2" /> Sil
                            </DropdownMenuItem>
                            </>
                          )}
                       </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
                {/* Render Targets */}
                {!isLoadingTargets && targets?.map((target) => (
                   <div key={target.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ top: `${target.latitude}%`, left: `${target.longitude}%` }} data-interactive>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button onClick={(e) => e.stopPropagation()} className="pointer-events-auto">
                             <Target className={`w-6 h-6 ${getTargetClasses(target.status)} cursor-pointer drop-shadow-lg`} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem disabled>
                              <div>
                                  <p className="font-semibold">Hədəf: {target.name}</p>
                                  <p className='text-muted-foreground text-xs'>Bölük: {units?.find(u => u.id === target.assignedUnitId)?.name ?? 'Naməlum'}</p>
                                  <p className='text-muted-foreground text-xs capitalize'>Status: {target.status}</p>
                              </div>
                            </DropdownMenuItem>
                          {isCommander && (
                              <>
                                  <DropdownMenuItem onSelect={() => handleEditTargetClick(target)}>
                                    <Edit size={14} className="mr-2" /> Redaktə et
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => handleDeleteTargetClick(target)} className="text-destructive focus:text-destructive">
                                    <Trash2 size={14} className="mr-2" /> Sil
                                  </DropdownMenuItem>
                              </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                   </div>
                ))}
                 {/* Render Decoys */}
                {!isLoadingDecoys && decoys?.map((decoy) => (
                   <Tooltip key={decoy.id} delayDuration={100}>
                      <TooltipTrigger asChild>
                        <div className="absolute" style={{ top: `${decoy.latitude}%`, left: `${decoy.longitude}%`, transform: 'translate(-50%, -50%)' }} data-interactive onClick={(e) => e.stopPropagation()}>
                          <div className="relative w-5 h-5 pointer-events-auto">
                              <div className="absolute inset-0 bg-red-600 rounded-full pulse-anim"></div>
                              <div className="absolute inset-1 bg-red-400 rounded-full"></div>
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent data-interactive className="max-w-sm p-4 bg-background/90 backdrop-blur-sm border-accent/20">
                          <p className='font-bold text-red-400 text-base mb-2'>Yem Hədəf: {decoy.publicName}</p>
                          {isCommander && (
                              <Button size="sm" className="w-full mt-2 bg-primary/80 hover:bg-primary" onClick={() => handleOpenDecryptDialog(decoy)}>
                                  <KeyRound className="mr-2" size={16} />
                                  Deşifrələ
                              </Button>
                          )}
                      </TooltipContent>
                  </Tooltip>
                ))}
              </div>
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={endDrawing}
                onMouseLeave={endDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={endDrawing}
                style={{ pointerEvents: isDrawingMode ? 'auto' : 'none', touchAction: 'none' }}
              />
            </div>
          </TooltipProvider>
        </CardContent>
      </Card>
      
      {/* Dialogs */}
      <Dialog open={isMapImportOpen} onOpenChange={setIsMapImportOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Xəritə İdxal Et</DialogTitle>
                <DialogDescription>
                    Yeni xəritə üçün bir şəkil URL-i daxil edin. Bu xəritə brauzerinizin yaddaşında saxlanacaq.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
                <Label htmlFor="map-url">Xəritə URL</Label>
                <Input id="map-url" placeholder="https://example.com/map.jpg" value={tempMapUrl} onChange={(e) => setTempMapUrl(e.target.value)} />
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsMapImportOpen(false)}>Ləğv et</Button>
                <Button onClick={handleSaveCustomMap}>Yadda Saxla</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isTargetDialogOpen} onOpenChange={setIsTargetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTarget ? 'Hədəfi Redaktə Et' : 'Yeni Hədəf Təyin Et'}</DialogTitle>
            <DialogDescription>
              {editingTarget ? 'Hədəfin məlumatlarını yeniləyin.' : 'Xəritədə seçdiyiniz nöqtəyə ad verin, status təyin edin və onu bir bölüyə təyin edin.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="target-name" className="text-right">Hədəf Adı</Label>
              <Input id="target-name" value={targetName} onChange={(e) => setTargetName(e.target.value)} className="col-span-3" placeholder="Məs. Alfa Nöqtəsi" />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="target-status" className="text-right">Status</Label>
              <Select onValueChange={(v) => setTargetStatus(v as OperationTarget['status'])} value={targetStatus}>
                <SelectTrigger className="col-span-3"><SelectValue placeholder="Status seçin..." /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="pending">Gözləmədə</SelectItem>
                    <SelectItem value="active">Aktiv</SelectItem>
                    <SelectItem value="passive">Passiv</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="unit-select" className="text-right">Bölük Seçin</Label>
              <Select onValueChange={setAssignedUnitId} value={assignedUnitId}>
                <SelectTrigger className="col-span-3"><SelectValue placeholder="Təyin olunacaq bölüyü seçin..." /></SelectTrigger>
                <SelectContent>
                  {isLoadingUnits ? (<SelectItem value="loading" disabled>Yüklənir...</SelectItem>) : (
                    units?.map((unit) => (<SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTargetDialogOpen(false)}>Ləğv Et</Button>
            <Button onClick={handleSaveTarget}>{editingTarget ? 'Yenilə' : 'Təyin Et'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isEncryptDialogOpen} onOpenChange={setIsEncryptDialogOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Şifrələmə Açarını Daxil Edin</DialogTitle>
                  <DialogDescription>Aktiv hədəflərin koordinatlarını şifrələmək üçün bir açar söz daxil edin. Bu açar deşifrələmə üçün tələb olunacaq.</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                  <Label htmlFor="encryption-key">Açar Söz</Label>
                  <Input id="encryption-key" type="password" value={encryptionKey} onChange={(e) => setEncryptionKey(e.target.value)} />
              </div>
              <DialogFooter>
                  <Button variant="outline" onClick={() => setIsEncryptDialogOpen(false)}>Ləğv Et</Button>
                  <Button onClick={handleStartEncryption}>Şifrələ</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
      
      <Dialog open={isDecryptDialogOpen} onOpenChange={setIsDecryptDialogOpen}>
          <DialogContent className="max-w-2xl">
              <DialogHeader>
                  <DialogTitle>Koordinatları Deşifrələ</DialogTitle>
                  <DialogDescription>"{decoyToDecrypt?.publicName}" adlı yemin orijinal koordinatlarını görmək üçün açar sözü daxil edin.</DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-2">
                  <Label htmlFor="decryption-key">Açar Söz</Label>
                  <Input id="decryption-key" type="password" value={decryptionKey} onChange={(e) => setDecryptionKey(e.target.value)} />
              </div>
              
              {showDecryptionLog && decoyToDecrypt && (
                <div className='mt-4 pt-4 border-t space-y-2 max-h-60 overflow-y-auto pr-4'>
                    <p className='font-semibold text-base mb-2 text-foreground'>Şifrələnmə Jurnalı:</p>
                    
                    <div className="space-y-1">
                      <p className="text-foreground font-semibold">Başlanğıc Koordinat (Orijinal)</p>
                      <p className="text-white text-sm pl-2 font-mono bg-muted/50 p-1 rounded-sm">{decoyToDecrypt.originalLat?.toFixed(6)}, {decoyToDecrypt.originalLng?.toFixed(6)}</p>
                    </div>
                    
                    <Accordion type="single" collapsible className="w-full">
                        {decoyToDecrypt.derivationSteps?.map((step, index) => (
                            <AccordionItem value={`item-${index}`} key={index}>
                                <AccordionTrigger className="text-sm py-2 hover:no-underline">
                                    <div className="flex flex-col text-left">
                                        <span className="text-foreground font-semibold">{index + 1}. {step.name}</span>
                                        <p className="text-white text-sm pl-2 font-mono bg-muted/50 p-1 rounded-sm mt-1">{step.latitude?.toFixed(6)}, {step.longitude?.toFixed(6)}</p>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="text-xs text-muted-foreground whitespace-pre-wrap pl-2 pb-2 font-mono">
                                    {step.details}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </div>
              )}
              
              {renderDecryptionResult()}

              <DialogFooter className="mt-4">
                  <Button variant="outline" onClick={() => setIsDecryptDialogOpen(false)}>Bağla</Button>
                  {!showDecryptionLog && (
                    <Button onClick={handleDecryption}>Deşifrələ</Button>
                  )}
              </DialogFooter>
          </DialogContent>
      </Dialog>

      <AlertDialog open={!!targetToDelete} onOpenChange={(open) => !open && setTargetToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Silməni Təsdiqlə</AlertDialogTitle>
            <AlertDialogDescription>"{targetToDelete?.name}" adlı hədəfi silmək istədiyinizdən əminsiniz? Bu əməliyyat geri qaytarıla bilməz.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTargetToDelete(null)}>Ləğv Et</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTarget} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Bəli, Sil</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <AlertDialog open={!!tacticalIconToDelete} onOpenChange={(open) => !open && setTacticalIconToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nişanı Sil</AlertDialogTitle>
            <AlertDialogDescription>"{tacticalIconToDelete?.label}" nişanını xəritədən silmək istədiyinizdən əminsiniz?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTacticalIconToDelete(null)}>Ləğv Et</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTacticalIcon} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Bəli, Sil</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isClearAllDialogOpen} onOpenChange={setIsClearAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xəritəni Təmizlə</AlertDialogTitle>
            <AlertDialogDescription>Bu əməliyyat xəritədəki bütün hədəfləri, yemləri, nişanları və cizgiləri birdəfəlik siləcək. Davam etmək istədiyinizdən əminsiniz?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ləğv Et</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAllPointsAndDrawings} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Bəli, Hamısını Sil</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

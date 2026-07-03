"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Check,
  Copy,
  Download,
  GripVertical,
  ImagePlus,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useDropzone } from "react-dropzone";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PhotoItem = {
  id: string;
  name: string;
  url: string;
};

type ColumnChoice = "auto" | "2" | "3" | "4";
type SpacingChoice = "small" | "medium" | "large";
type BackgroundChoice = "white" | "transparent" | "beige" | "gray";
type BorderChoice = "none" | "fine" | "rounded";
type CellFormatChoice = "square" | "vertical" | "horizontal" | "auto";
type GridSizeChoice = "small" | "medium" | "large" | "report";
type ExportFormat = "png" | "jpeg";

const columnOptions: Array<{ value: ColumnChoice; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
];

const spacingOptions: Array<{ value: SpacingChoice; label: string }> = [
  { value: "small", label: "Pequeno" },
  { value: "medium", label: "Médio" },
  { value: "large", label: "Grande" },
];

const backgroundOptions: Array<{ value: BackgroundChoice; label: string }> = [
  { value: "white", label: "Branco" },
  { value: "transparent", label: "Transp." },
  { value: "beige", label: "Bege" },
  { value: "gray", label: "Cinza" },
];

const borderOptions: Array<{ value: BorderChoice; label: string }> = [
  { value: "none", label: "Sem borda" },
  { value: "fine", label: "Fina" },
  { value: "rounded", label: "Arred." },
];

const sizeOptions: Array<{ value: GridSizeChoice; label: string }> = [
  { value: "report", label: "Relatório" },
  { value: "medium", label: "Médio" },
  { value: "small", label: "Pequeno" },
  { value: "large", label: "Grande" },
];

const formatOptions: Array<{ value: CellFormatChoice; label: string }> = [
  { value: "vertical", label: "Vertical" },
  { value: "square", label: "Quadrado" },
  { value: "horizontal", label: "Horizontal" },
  { value: "auto", label: "Auto" },
];

const spacingByChoice: Record<SpacingChoice, number> = {
  small: 8,
  medium: 14,
  large: 22,
};

const backgroundByChoice: Record<BackgroundChoice, string> = {
  white: "#ffffff",
  transparent: "transparent",
  beige: "#fbf3e4",
  gray: "#f3f5f4",
};

const gridWidthByChoice: Record<GridSizeChoice, number> = {
  small: 720,
  medium: 900,
  large: 1180,
  report: 1040,
};

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function resolveAutomaticColumns(photoCount: number) {
  if (photoCount <= 1) return 1;
  if (photoCount === 2) return 2;
  if (photoCount === 4) return 2;
  if (photoCount >= 10 && photoCount <= 12) return 4;

  return 3;
}

function resolveAspectRatio(format: CellFormatChoice, columns: number) {
  if (format === "square") return "1 / 1";
  if (format === "horizontal") return "4 / 3";
  if (format === "auto") return columns <= 2 ? "4 / 3" : "3 / 4";

  return "3 / 4";
}

function resolveAspectRatioValue(format: CellFormatChoice, columns: number) {
  if (format === "square") return 1;
  if (format === "horizontal") return 4 / 3;
  if (format === "auto") return columns <= 2 ? 4 / 3 : 3 / 4;

  return 3 / 4;
}

function fileListLabel(count: number) {
  if (count === 0) return "Nenhuma foto";
  if (count === 1) return "1 foto";

  return `${count} fotos`;
}

function loadExportImage(photo: PhotoItem) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error(`Nao foi possivel carregar ${photo.name}.`));
    image.src = photo.url;
  });
}

function drawRoundedPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const resolvedRadius = Math.min(radius, width / 2, height / 2);

  context.beginPath();
  context.moveTo(x + resolvedRadius, y);
  context.lineTo(x + width - resolvedRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + resolvedRadius);
  context.lineTo(x + width, y + height - resolvedRadius);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - resolvedRadius,
    y + height,
  );
  context.lineTo(x + resolvedRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - resolvedRadius);
  context.lineTo(x, y + resolvedRadius);
  context.quadraticCurveTo(x, y, x + resolvedRadius, y);
  context.closePath();
}

function drawCellShape(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  border: BorderChoice,
) {
  if (border === "rounded") {
    drawRoundedPath(context, x, y, width, height, 8);
    context.fill();
    return;
  }

  context.fillRect(x, y, width, height);
}

function strokeCellShape(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  border: BorderChoice,
) {
  if (border === "none") return;

  context.save();
  context.strokeStyle = "#e7e5e4";
  context.lineWidth = 1;

  if (border === "rounded") {
    drawRoundedPath(context, x + 0.5, y + 0.5, width - 1, height - 1, 8);
    context.stroke();
  } else {
    context.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
  }

  context.restore();
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: ExportFormat,
  quality?: number,
) {
  const mimeType = format === "png" ? "image/png" : "image/jpeg";

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Nao foi possivel gerar a imagem do grid."));
          return;
        }

        resolve(blob);
      },
      mimeType,
      quality,
    );
  });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

type SegmentOption<T extends string> = {
  value: T;
  label: string;
};

type SegmentGroupProps<T extends string> = {
  label: string;
  value: T;
  options: Array<SegmentOption<T>>;
  onChange: React.Dispatch<React.SetStateAction<T>>;
};

function SegmentGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentGroupProps<T>) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-emerald-950">{label}</div>

      <div className="grid grid-cols-4 gap-2">
        {options.map((option) => {
          const selected = value === option.value;

          return (
            <button
              aria-pressed={selected}
              className={cn(
                "flex h-12 w-full min-w-0 items-center justify-center rounded-md border px-1.5",
                "text-center text-[12px] font-medium leading-none transition",
                "overflow-hidden whitespace-nowrap",
                selected
                  ? "border-emerald-700 bg-emerald-700 text-white shadow-sm"
                  : "border-stone-300 bg-white text-emerald-950 hover:border-emerald-500 hover:bg-emerald-50",
              )}
              key={option.value}
              onClick={() => onChange(option.value)}
              title={option.label}
              type="button"
            >
              <span className="block max-w-full truncate">
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SortablePhoto({
  photo,
  onRemove,
}: {
  photo: PhotoItem;
  onRemove: (photo: PhotoItem) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: photo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-stone-200 bg-white p-2 shadow-sm",
        isDragging && "relative z-10 border-emerald-600 shadow-panel",
      )}
      ref={setNodeRef}
      style={style}
    >
      <button
        aria-label="Arrastar foto"
        className="flex h-10 w-9 cursor-grab items-center justify-center rounded-md border border-stone-200 bg-stone-50 text-stone-500 active:cursor-grabbing"
        title="Arrastar foto"
        type="button"
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" className="h-4 w-4" />
      </button>
      <div className="grid min-w-0 grid-cols-[54px_minmax(0,1fr)] items-center gap-3">
        <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-md border border-stone-200 bg-white">
          <img
            alt=""
            className="h-full w-full object-contain"
            draggable={false}
            src={photo.url}
          />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-emerald-950">
            {photo.name}
          </div>
          <div className="text-xs text-stone-500">Foto inteira preservada</div>
        </div>
      </div>
      <Button
        aria-label="Remover foto"
        onClick={() => onRemove(photo)}
        size="icon"
        title="Remover foto"
        type="button"
        variant="ghost"
      >
        <Trash2 aria-hidden="true" />
      </Button>
    </div>
  );
}

export default function Home() {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [columns, setColumns] = useState<ColumnChoice>("3");
  const [spacing, setSpacing] = useState<SpacingChoice>("medium");
  const [background, setBackground] = useState<BackgroundChoice>("white");
  const [border, setBorder] = useState<BorderChoice>("fine");
  const [cellFormat, setCellFormat] = useState<CellFormatChoice>("vertical");
  const [gridSize, setGridSize] = useState<GridSizeChoice>("report");
  const [status, setStatus] = useState<{
    type: "idle" | "success" | "error";
    message: string;
  }>({ type: "idle", message: "" });
  const [isExporting, setIsExporting] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  const gridRef = useRef<HTMLDivElement | null>(null);
  const objectUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current = [];
    };
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const imageFiles = acceptedFiles.filter((file) =>
      file.type.startsWith("image/"),
    );

    if (imageFiles.length === 0) {
      setStatus({
        type: "error",
        message: "Envie arquivos de imagem para montar o grid.",
      });
      return;
    }

    const nextPhotos = imageFiles.map((file) => {
      const url = URL.createObjectURL(file);
      objectUrlsRef.current.push(url);

      return {
        id: createId(),
        name: file.name,
        url,
      };
    });

    setPhotos((current) => [...current, ...nextPhotos]);
    setStatus({
      type: "success",
      message:
        nextPhotos.length === 1
          ? "1 foto adicionada."
          : `${nextPhotos.length} fotos adicionadas.`,
    });
  }, []);

  const { getInputProps, getRootProps, isDragActive, open } = useDropzone({
    accept: {
      "image/*": [],
    },
    multiple: true,
    noClick: true,
    onDrop,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const resolvedColumns = useMemo(() => {
    if (columns === "auto") return resolveAutomaticColumns(photos.length);

    return Number(columns);
  }, [columns, photos.length]);

  const gap = spacingByChoice[spacing];
  const gridBackground = backgroundByChoice[background];
  const gridWidth = gridWidthByChoice[gridSize];
  const aspectRatio = resolveAspectRatio(cellFormat, resolvedColumns);
  const aspectRatioValue = resolveAspectRatioValue(cellFormat, resolvedColumns);
  const hasPhotos = photos.length > 0;

  const removePhoto = useCallback((photo: PhotoItem) => {
    URL.revokeObjectURL(photo.url);
    objectUrlsRef.current = objectUrlsRef.current.filter(
      (url) => url !== photo.url,
    );
    setPhotos((current) => current.filter((item) => item.id !== photo.id));
  }, []);

  const clearPhotos = useCallback(() => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
    setPhotos([]);
    setStatus({ type: "idle", message: "" });
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    setPhotos((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      return arrayMove(items, oldIndex, newIndex);
    });
  }, []);

  const buildGridBlob = useCallback(
    async (format: ExportFormat) => {
      if (!hasPhotos) {
        throw new Error("Envie fotos antes de gerar o grid.");
      }

      const scale = 2;
      const rows = Math.ceil(photos.length / resolvedColumns);
      const cellWidth =
        (gridWidth - gap * (resolvedColumns + 1)) / resolvedColumns;
      const cellHeight = cellWidth / aspectRatioValue;
      const canvasWidth = Math.ceil(gridWidth * scale);
      const canvasHeight = Math.ceil(
        (gap * 2 + rows * cellHeight + Math.max(0, rows - 1) * gap) * scale,
      );
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("O navegador nao conseguiu preparar a imagem.");
      }

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      context.scale(scale, scale);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";

      if (format === "jpeg" || background !== "transparent") {
        context.fillStyle =
          background === "transparent" ? "#ffffff" : gridBackground;
        context.fillRect(0, 0, gridWidth, canvasHeight / scale);
      }

      const cellBackground =
        gridBackground === "transparent" ? "#ffffff" : gridBackground;

      for (const [index, photo] of photos.entries()) {
        const image = await loadExportImage(photo);
        const column = index % resolvedColumns;
        const row = Math.floor(index / resolvedColumns);
        const x = gap + column * (cellWidth + gap);
        const y = gap + row * (cellHeight + gap);
        const imageRatio = image.naturalWidth / image.naturalHeight;
        let drawWidth = cellWidth;
        let drawHeight = drawWidth / imageRatio;

        if (drawHeight > cellHeight) {
          drawHeight = cellHeight;
          drawWidth = drawHeight * imageRatio;
        }

        context.save();
        context.fillStyle = cellBackground;
        drawCellShape(context, x, y, cellWidth, cellHeight, border);
        context.drawImage(
          image,
          x + (cellWidth - drawWidth) / 2,
          y + (cellHeight - drawHeight) / 2,
          drawWidth,
          drawHeight,
        );
        strokeCellShape(context, x, y, cellWidth, cellHeight, border);
        context.restore();
      }

      return canvasToBlob(canvas, format, format === "jpeg" ? 0.95 : undefined);
    },
    [
      aspectRatioValue,
      background,
      border,
      gap,
      gridBackground,
      gridWidth,
      hasPhotos,
      photos,
      resolvedColumns,
    ],
  );

  const downloadBlob = useCallback((blob: Blob, extension: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `grid-facil-escolar-${new Date()
      .toISOString()
      .slice(0, 10)}.${extension}`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  const copyBlobAsHtmlImage = useCallback(async (blob: Blob) => {
    const dataUrl = await blobToDataUrl(blob);
    const html = `<img src="${dataUrl}" alt="Grid Facil Escolar" />`;

    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": blob,
          "text/html": new Blob([html], { type: "text/html" }),
        }),
      ]);
      return;
    }

    const copyListener = (event: ClipboardEvent) => {
      event.clipboardData?.setData("text/html", html);
      event.clipboardData?.setData("text/plain", "Grid Facil Escolar");
      event.preventDefault();
    };

    document.addEventListener("copy", copyListener);
    const copied = document.execCommand("copy");
    document.removeEventListener("copy", copyListener);

    if (!copied) {
      throw new Error("O navegador bloqueou a copia.");
    }
  }, []);

  const downloadPng = useCallback(async () => {
    if (!hasPhotos) return;

    setIsExporting(true);
    try {
      const blob = await buildGridBlob("png");
      downloadBlob(blob, "png");
      setStatus({
        type: "success",
        message: "PNG gerado com o grid inteiro.",
      });
    } catch (error) {
      console.error(error);
      setStatus({
        type: "error",
        message: "Não foi possível gerar o PNG. Tente novamente.",
      });
    } finally {
      setIsExporting(false);
    }
  }, [buildGridBlob, downloadBlob, hasPhotos]);

  const downloadJpg = useCallback(async () => {
    if (!hasPhotos) return;

    setIsExporting(true);
    try {
      const blob = await buildGridBlob("jpeg");
      downloadBlob(blob, "jpg");
      setStatus({
        type: "success",
        message: "JPG gerado com fundo pronto para relatório.",
      });
    } catch (error) {
      console.error(error);
      setStatus({
        type: "error",
        message: "Não foi possível gerar o JPG. Tente novamente.",
      });
    } finally {
      setIsExporting(false);
    }
  }, [buildGridBlob, downloadBlob, hasPhotos]);

  const copyGrid = useCallback(async () => {
    if (!hasPhotos) return;

    setIsCopying(true);
    try {
      const blob = await buildGridBlob("png");
      await copyBlobAsHtmlImage(blob);
      setStatus({
        type: "success",
        message: "Grid copiado. Agora cole no Word ou Google Docs.",
      });
    } catch (error) {
      console.error(error);
      try {
        const blob = await buildGridBlob("png");
        downloadBlob(blob, "png");
      } catch (downloadError) {
        console.error(downloadError);
      }
      setStatus({
        type: "error",
        message:
          "O navegador bloqueou a cópia. Baixei o PNG como alternativa.",
      });
    } finally {
      setIsCopying(false);
    }
  }, [buildGridBlob, copyBlobAsHtmlImage, downloadBlob, hasPhotos]);

  return (
    <main className="min-h-screen bg-[#f7faf8] px-4 py-5 text-emerald-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
        <header className="flex flex-col gap-3 border-b border-stone-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-emerald-700">
              MontaGrid Escolar
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-emerald-950 sm:text-4xl">
              Grid Fácil Escolar
            </h1>
            <p className="mt-2 max-w-2xl text-base text-stone-600">
              Monte o bloco de fotos do relatório sem cortar nenhum aluno.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
            <span className="rounded-md border border-emerald-200 bg-white px-3 py-2 font-medium text-emerald-800">
              {fileListLabel(photos.length)}
            </span>
            <span className="rounded-md border border-stone-200 bg-white px-3 py-2">
              {resolvedColumns} coluna(s)
            </span>
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
          <section className="flex flex-col gap-4">
            <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-panel">
              <div
                {...getRootProps({
                  className: cn(
                    "flex min-h-40 flex-col items-center justify-center gap-3 rounded-md border border-dashed border-stone-300 bg-stone-50 p-5 text-center transition",
                    isDragActive && "border-emerald-600 bg-emerald-50",
                  ),
                })}
              >
                <input {...getInputProps()} />
                <div className="grid h-12 w-12 place-items-center rounded-md bg-emerald-100 text-emerald-800">
                  <ImagePlus aria-hidden="true" className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold text-emerald-950">
                    Enviar fotos
                  </p>
                  <p className="mt-1 text-sm text-stone-500">
                    Arraste imagens aqui ou selecione do computador.
                  </p>
                </div>
                <Button onClick={open} type="button">
                  <Upload aria-hidden="true" />
                  Escolher fotos
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-panel">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Configurações</h2>
                <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800">
                  sem corte
                </span>
              </div>
              <div className="space-y-5">
                <SegmentGroup<GridSizeChoice>
                  label="Tamanho"
                  onChange={setGridSize}
                  options={sizeOptions}
                  value={gridSize}
                />

                <SegmentGroup<ColumnChoice>
                  label="Colunas"
                  onChange={setColumns}
                  options={columnOptions}
                  value={columns}
                />

                <SegmentGroup<SpacingChoice>
                  label="Espaçamento"
                  onChange={setSpacing}
                  options={spacingOptions}
                  value={spacing}
                />

                <SegmentGroup<BackgroundChoice>
                  label="Fundo"
                  onChange={setBackground}
                  options={backgroundOptions}
                  value={background}
                />

                <SegmentGroup<BorderChoice>
                  label="Borda"
                  onChange={setBorder}
                  options={borderOptions}
                  value={border}
                />

                <SegmentGroup<CellFormatChoice>
                  label="Células"
                  onChange={setCellFormat}
                  options={formatOptions}
                  value={cellFormat}
                />
              </div>
            </div>

            <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-panel">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Ordem das fotos</h2>
                {hasPhotos ? (
                  <Button
                    onClick={clearPhotos}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <X aria-hidden="true" />
                    Limpar
                  </Button>
                ) : null}
              </div>
              {hasPhotos ? (
                <DndContext
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                  sensors={sensors}
                >
                  <SortableContext
                    items={photos.map((photo) => photo.id)}
                    strategy={rectSortingStrategy}
                  >
                    <div className="grid gap-2">
                      {photos.map((photo) => (
                        <SortablePhoto
                          key={photo.id}
                          onRemove={removePhoto}
                          photo={photo}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <div className="rounded-md border border-stone-200 bg-stone-50 p-4 text-sm text-stone-500">
                  As miniaturas aparecem aqui depois do upload.
                </div>
              )}
            </div>
          </section>

          <section className="min-w-0 rounded-lg border border-stone-200 bg-white p-4 shadow-panel">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Prévia do grid</h2>
                <p className="mt-1 text-sm text-stone-500">
                  O bloco abaixo será copiado e exportado como uma imagem única.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={!hasPhotos || isCopying}
                  onClick={copyGrid}
                  size="lg"
                  type="button"
                >
                  {isCopying ? (
                    <Loader2 aria-hidden="true" className="animate-spin" />
                  ) : (
                    <Copy aria-hidden="true" />
                  )}
                  Copiar grid
                </Button>
                <Button
                  disabled={!hasPhotos || isExporting}
                  onClick={downloadPng}
                  type="button"
                  variant="secondary"
                >
                  {isExporting ? (
                    <Loader2 aria-hidden="true" className="animate-spin" />
                  ) : (
                    <Download aria-hidden="true" />
                  )}
                  PNG
                </Button>
                <Button
                  disabled={!hasPhotos || isExporting}
                  onClick={downloadJpg}
                  type="button"
                  variant="outline"
                >
                  <Download aria-hidden="true" />
                  JPG
                </Button>
              </div>
            </div>

            {status.message ? (
              <div
                className={cn(
                  "mb-4 flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                  status.type === "success" &&
                  "border-emerald-200 bg-emerald-50 text-emerald-800",
                  status.type === "error" &&
                  "border-red-200 bg-red-50 text-red-700",
                )}
              >
                {status.type === "success" ? (
                  <Check aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <X aria-hidden="true" className="h-4 w-4" />
                )}
                {status.message}
              </div>
            ) : null}

            <div className="min-h-[620px] overflow-auto rounded-md border border-stone-200 bg-[repeating-linear-gradient(45deg,#f7f7f4_0,#f7f7f4_10px,#efeee9_10px,#efeee9_20px)] p-5">
              {hasPhotos ? (
                <div
                  className="mx-auto"
                  ref={gridRef}
                  style={{
                    background: gridBackground,
                    display: "grid",
                    gap,
                    gridTemplateColumns: `repeat(${resolvedColumns}, minmax(0, 1fr))`,
                    padding: gap,
                    width: gridWidth,
                  }}
                >
                  {photos.map((photo) => (
                    <div
                      className={cn(
                        "grid-photo-cell",
                        border === "fine" &&
                        "border border-stone-200 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55)]",
                        border === "rounded" &&
                        "rounded-md border border-stone-200 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55)]",
                      )}
                      key={photo.id}
                      style={{
                        aspectRatio,
                        background: gridBackground === "transparent" ? "#ffffff" : gridBackground,
                      }}
                    >
                      <img alt={photo.name} draggable={false} src={photo.url} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid min-h-[560px] place-items-center rounded-md border border-dashed border-stone-300 bg-white/80 p-6 text-center">
                  <div className="max-w-sm">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-md bg-emerald-100 text-emerald-800">
                      <ImagePlus aria-hidden="true" className="h-6 w-6" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold">
                      Envie fotos para ver o grid
                    </h3>
                    <p className="mt-2 text-sm text-stone-500">
                      A prévia aparece aqui com células padronizadas e imagem
                      inteira dentro de cada espaço.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

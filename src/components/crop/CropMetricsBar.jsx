import React from 'react';
import { ShieldCheck, AlertTriangle, AlertCircle, ZoomIn, Info } from 'lucide-react';
import { MIN_CROP_DPI } from '../../utils/frameFit';

/**
 * Visual quality gauge and technical metrics for image cropping and print resolution.
 */
export default function CropMetricsBar({ imageNatural, geometry, crop, position, className = '' }) {
    if (!imageNatural?.w || !imageNatural?.h || !geometry || !crop) {
        return null;
    }

    // Effective print DPI: pixels per inch of printed aperture
    const effectiveDpi = geometry.apertureWidth > 0
        ? Math.round(crop.w / geometry.apertureWidth)
        : 300;

    // Retained area %
    const retainedPct = Math.round((crop.retained || 1) * 100);

    // DPI classification
    let dpiStatus = {
        level: 'excellent',
        label: 'Museum Ultra-Res',
        color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        badge: 'bg-emerald-500',
        icon: ShieldCheck,
        description: 'Exceeds fine-art gallery standards (300+ DPI). Razor-sharp print detail.'
    };

    if (effectiveDpi < MIN_CROP_DPI) {
        dpiStatus = {
            level: 'critical',
            label: 'Below Print Floor',
            color: 'text-rose-700 bg-rose-50 border-rose-200',
            badge: 'bg-rose-500',
            icon: AlertCircle,
            description: `Below Prodigi's ${MIN_CROP_DPI} DPI production floor. Risk of soft focus or pixelation.`
        };
    } else if (effectiveDpi < 200) {
        dpiStatus = {
            level: 'warning',
            label: 'Acceptable Floor',
            color: 'text-amber-700 bg-amber-50 border-amber-200',
            badge: 'bg-amber-500',
            icon: AlertTriangle,
            description: 'Meets minimum production floor. Acceptable at standard viewing distances.'
        };
    } else if (effectiveDpi < 300) {
        dpiStatus = {
            level: 'good',
            label: 'High Quality',
            color: 'text-teal-700 bg-teal-50 border-teal-200',
            badge: 'bg-teal-500',
            icon: ShieldCheck,
            description: 'Crisp, high-fidelity gallery print quality.'
        };
    }

    const DpiIcon = dpiStatus.icon;
    const posX = Math.round((position?.x ?? 0.5) * 100);
    const posY = Math.round((position?.y ?? 0.5) * 100);
    const zoomVal = (position?.zoom ?? 1).toFixed(2);

    return (
        <div className={`bg-stone-50 border border-stone-200/80 rounded-xl p-3 sm:p-4 text-stone-800 ${className}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Print Quality & Cropping Telemetry</span>
                </div>
                {/* DPI Status Badge */}
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${dpiStatus.color}`}>
                    <DpiIcon size={14} className="shrink-0" />
                    <span>{effectiveDpi} DPI</span>
                    <span className="opacity-40">·</span>
                    <span>{dpiStatus.label}</span>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-white p-2.5 rounded-lg border border-stone-200/60 shadow-sm">
                    <div className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">Effective DPI</div>
                    <div className="font-mono font-bold text-stone-900 text-sm mt-0.5 flex items-center gap-1">
                        {effectiveDpi} <span className="text-[10px] font-sans font-normal text-stone-400">DPI</span>
                    </div>
                    <div className="text-[10px] text-stone-500 mt-0.5">Floor: {MIN_CROP_DPI} DPI</div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-stone-200/60 shadow-sm">
                    <div className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">Image Retained</div>
                    <div className="font-mono font-bold text-stone-900 text-sm mt-0.5">
                        {retainedPct}%
                    </div>
                    <div className="text-[10px] text-stone-500 mt-0.5">{Math.round(crop.w)} × {Math.round(crop.h)} px</div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-stone-200/60 shadow-sm">
                    <div className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">Crop Center</div>
                    <div className="font-mono font-bold text-stone-900 text-sm mt-0.5">
                        X: {posX}% · Y: {posY}%
                    </div>
                    <div className="text-[10px] text-stone-500 mt-0.5">Normalized: [{position?.x?.toFixed(2) ?? 0.5}, {position?.y?.toFixed(2) ?? 0.5}]</div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-stone-200/60 shadow-sm">
                    <div className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">Zoom Level</div>
                    <div className="font-mono font-bold text-stone-900 text-sm mt-0.5 flex items-center gap-1">
                        <ZoomIn size={13} className="text-stone-400" />
                        {zoomVal}×
                    </div>
                    <div className="text-[10px] text-stone-500 mt-0.5">Scale: {Math.round((position?.zoom ?? 1) * 100)}%</div>
                </div>
            </div>

            {/* Descriptive Note */}
            <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-stone-500">
                <Info size={12} className="shrink-0 text-stone-400" />
                <span>{dpiStatus.description}</span>
            </div>
        </div>
    );
}

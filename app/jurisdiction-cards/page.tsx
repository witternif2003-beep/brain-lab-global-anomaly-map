"use client";
import React from "react";
import { LayoutGrid } from "lucide-react";
import PageEmblemHeader from "../../components/PageEmblemHeader";
import JurisdictionCardGrid from "../../components/jurisdiction-cards/JurisdictionCardGrid";

export default function JurisdictionCardsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6 font-mono">
      <PageEmblemHeader
        badgeText="56-Jurisdiction Card Pipeline"
        badgeIcon={<LayoutGrid className="w-4 h-4 text-sky-400" />}
        title="JURISDICTION CARDS — 50 STATES, DC & 5 TERRITORIES"
        description="One card per jurisdiction with an identical field set. Values come only from live public APIs (BLS LAUS, EPA ECHO, Census ACS, World Bank) with source URL, retrieval time and SHA-256 attached. Fields without a source stay empty and are labelled awaiting-source, not-published or error."
      />
      <JurisdictionCardGrid />
    </div>
  );
}

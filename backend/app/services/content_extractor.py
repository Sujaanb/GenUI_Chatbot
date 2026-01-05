"""
Content extraction service for converting Thesys UI JSON responses to readable text.
Extracts human-readable content from JSON/UI component markup while preserving
data patterns that allow chart generation by PDF/Word services.
"""

import html
import json
import re
from typing import Any, Dict


class ContentExtractor:
    """Extracts human-readable content from Thesys JSON/UI responses."""

    def extract_readable_content(self, response: str) -> str:
        """
        Main entry point: Extract readable content from a Thesys response.
        """
        if not response:
            return ""

        # Decode HTML entities first (e.g., &quot; -> ")
        decoded_response = html.unescape(response)

        # Try to find content within <content> tags
        content_match = re.search(
            r"<content[^>]*>(.*?)</content>", decoded_response, re.DOTALL
        )
        if content_match:
            json_str = content_match.group(1).strip()
        else:
            json_str = decoded_response.strip()

        # Try to parse JSON
        try:
            data = json.loads(json_str)
            return self._extract_all(data)
        except json.JSONDecodeError:
            # Try to find JSON within the text
            if json_str.startswith("{"):
                try:
                    # Find matching brace
                    brace_count = 0
                    end = 0
                    for i, char in enumerate(json_str):
                        if char == "{":
                            brace_count += 1
                        elif char == "}":
                            brace_count -= 1
                            if brace_count == 0:
                                end = i + 1
                                break
                    if end > 0:
                        data = json.loads(json_str[:end])
                        return self._extract_all(data)
                except json.JSONDecodeError:
                    pass

            # Return cleaned text if not JSON
            return decoded_response

    def _extract_all(self, data: Any) -> str:
        """Recursively extract all text content from the data structure."""
        if data is None:
            return ""

        if isinstance(data, str):
            return data

        if isinstance(data, (int, float)):
            return str(data)

        if isinstance(data, list):
            parts = []
            for item in data:
                extracted = self._extract_all(item)
                if extracted:
                    parts.append(extracted)
            return "\n\n".join(parts)

        if isinstance(data, dict):
            # Check if this is a component
            if "component" in data:
                return self._extract_component(data)

            # Process special keys
            parts = []

            # Check for wrapped component structure
            for key in [
                "component",
                "content",
                "children",
                "sections",
                "items",
                "rows",
            ]:
                if key in data:
                    extracted = self._extract_all(data[key])
                    if extracted:
                        parts.append(extracted)

            # If nothing extracted from special keys, try all values
            if not parts:
                for key, value in data.items():
                    if key not in [
                        "iconName",
                        "iconCategory",
                        "variant",
                        "type",
                        "isFoldable",
                        "value",
                    ]:
                        extracted = self._extract_all(value)
                        if extracted:
                            parts.append(extracted)

            return "\n\n".join(parts)

        return ""

    def _extract_component(self, comp: Dict) -> str:
        """Extract content from a component based on its type."""
        comp_type_val = comp.get("component", "")

        # Handle nested component wrapper
        if isinstance(comp_type_val, dict):
            return self._extract_component(comp_type_val)

        comp_type = comp_type_val.lower() if isinstance(comp_type_val, str) else ""
        props = comp.get("props", {})

        parts = []

        # Extract based on component type
        if comp_type in ["header", "inlineheader"]:
            title = props.get("title", "") or props.get("heading", "")
            subtitle = props.get("subtitle", "") or props.get("description", "")
            if title:
                parts.append(f"## {title}")
            if subtitle:
                parts.append(subtitle)

        elif comp_type in ["textcontent", "text", "paragraph"]:
            text = (
                props.get("textMarkdown", "")
                or props.get("text", "")
                or props.get("content", "")
            )
            if text:
                parts.append(text)

        elif comp_type in ["datatile", "minicard"]:
            amount = props.get("amount", "")
            description = props.get("description", "")
            if amount and description:
                parts.append(f"**{description}**: {amount}")
            # Extract from lhs if present
            lhs = props.get("lhs")
            if isinstance(lhs, dict):
                parts.append(self._extract_component(lhs))

        elif comp_type == "card":
            title = props.get("title", "")
            value = props.get("value", "")
            if title:
                if value:
                    parts.append(f"**{title}**: {value}")
                else:
                    parts.append(f"**{title}**")

        elif comp_type == "list":
            heading = props.get("heading", "")
            description = props.get("description", "")
            items = props.get("items", [])

            if heading:
                parts.append(f"### {heading}")
            if description:
                parts.append(description)

            for item in items:
                if isinstance(item, dict):
                    title = item.get("title", "")
                    subtitle = item.get("subtitle", "")
                    value = item.get("value", "")
                    if title:
                        if value:
                            parts.append(f"- {title}: {value}")
                        elif subtitle:
                            parts.append(f"- **{title}**: {subtitle}")
                        else:
                            parts.append(f"- {title}")
                elif isinstance(item, str):
                    parts.append(f"- {item}")

        elif comp_type == "table":
            header = props.get("tableHeader", {})
            body = props.get("tableBody", {})

            header_rows = header.get("rows", [])
            body_rows = body.get("rows", [])

            # Extract header
            if header_rows:
                header_cells = []
                for cell in header_rows:
                    if isinstance(cell, dict):
                        header_cells.append(str(cell.get("children", "")))
                    else:
                        header_cells.append(str(cell))
                if header_cells:
                    parts.append("| " + " | ".join(header_cells) + " |")
                    parts.append("| " + " | ".join(["---"] * len(header_cells)) + " |")

            # Extract body
            for row in body_rows:
                if isinstance(row, dict):
                    cells = row.get("children", [])
                    if isinstance(cells, list):
                        parts.append("| " + " | ".join(str(c) for c in cells) + " |")
                elif isinstance(row, list):
                    parts.append("| " + " | ".join(str(c) for c in row) + " |")

        elif comp_type in [
            "barchartv2",
            "barchart",
            "piechartv2",
            "piechart",
            "linechartv2",
            "linechart",
        ]:
            # Extract chart title from various locations
            title = props.get("title", "") or props.get("heading", "")
            chart_data = props.get("chartData", {})
            data = chart_data.get("data", {})

            if title:
                parts.append(f"### {title}")

            # Handle different data formats
            if isinstance(data, dict):
                labels = data.get("labels", [])
                series = data.get("series", [])

                # Extract from series
                for s in series:
                    if isinstance(s, dict):
                        category = s.get("category", "")
                        values = s.get("values", [])
                        if labels and values:
                            for label, value in zip(labels, values):
                                parts.append(f"- {label}: {value}")

                # If no series, check for values directly
                if not series:
                    values = data.get("values", []) or data.get("data", [])
                    if labels and values:
                        for label, value in zip(labels, values):
                            parts.append(f"- {label}: {value}")

            elif isinstance(data, list):
                # Pie chart format: [{"category": "Open", "value": 8}, ...]
                for item in data:
                    if isinstance(item, dict):
                        cat = item.get("category", "")
                        val = item.get("value", "")
                        if cat and val is not None:
                            parts.append(f"- {cat}: {val}")

        elif comp_type == "sectionblock":
            sections = props.get("sections", [])
            for section in sections:
                if isinstance(section, dict):
                    trigger = section.get("trigger", "")
                    if trigger:
                        parts.append(f"### {trigger}")
                    content = section.get("content", [])
                    for c in content:
                        if isinstance(c, dict):
                            parts.append(self._extract_component(c))

        elif comp_type == "layout":
            # Layout contains nested structures
            children = props.get("children", {})
            if isinstance(children, dict):
                rows = children.get("rows", [])
                for row in rows:
                    if isinstance(row, dict):
                        for key in [
                            "headerLeft",
                            "headerRight",
                            "mediumLeft",
                            "mediumRight",
                        ]:
                            if key in row:
                                val = row[key]
                                if isinstance(val, dict):
                                    parts.append(self._extract_component(val))
                                elif isinstance(val, list):
                                    for item in val:
                                        if isinstance(item, dict):
                                            parts.append(self._extract_component(item))

        elif comp_type == "minicardblock":
            children = props.get("children", [])
            for child in children:
                if isinstance(child, dict):
                    parts.append(self._extract_component(child))

        # Always process children/content arrays for any component
        for key in ["children", "content"]:
            if key in props:
                val = props[key]
                if isinstance(val, list):
                    for child in val:
                        if isinstance(child, dict):
                            child_content = self._extract_component(child)
                            if child_content and child_content not in parts:
                                parts.append(child_content)

        return "\n".join(filter(None, parts))

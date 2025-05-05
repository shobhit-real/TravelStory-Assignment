import React, { useRef, useState, useEffect } from "react";
import interact from "interactjs";
import anime from 'animejs';
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export default function Canvas() {
  const [selectedTextBlock, setSelectedTextBlock] = useState(null);
  const canvasRef = useRef(null);
  const [saveMessage, setSaveMessage] = useState("");
  const saveMessageRef = useRef(null);

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const wrapper = document.createElement("div");
        wrapper.className = "image-wrapper";
        wrapper.style.position = "absolute";
        wrapper.style.top = "100px";
        wrapper.style.left = "100px";

        const img = document.createElement("img");
        img.src = evt.target.result;
        img.style.maxWidth = "300px";
        img.style.transformOrigin = "center center";
        img.style.pointerEvents = "none";

        const rotateHandle = document.createElement("div");
        rotateHandle.className = "rotate-handle";
        rotateHandle.innerHTML = "\u21BB";

        rotateHandle.style.position = "absolute";
        rotateHandle.style.top = "-25px";
        rotateHandle.style.left = "50%";
        rotateHandle.style.transform = "translateX(-50%)";
        rotateHandle.style.cursor = "grab";
        rotateHandle.style.userSelect = "none";

        wrapper.appendChild(img);
        wrapper.appendChild(rotateHandle);
        canvasRef.current.appendChild(wrapper);

        makeDraggable(wrapper, img, rotateHandle);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = null;
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith("image/"));

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const img = document.createElement("img");
        img.src = evt.target.result;
        img.style.position = "relative";
        img.style.width = "auto";
        img.style.maxWidth = "80vw";
        img.style.maxHeight = "80vh";
        img.style.cursor = "move";
        canvasRef.current.appendChild(img);
        makeDraggable(img);
      };
      reader.readAsDataURL(file);
    });
  };

  const addTextBlock = () => {
    const div = document.createElement("div");
    div.className = "text-block";
    div.contentEditable = true;
    div.innerText = "Edit text...";
    Object.assign(div.style, textBlockStyle);
    div.addEventListener("click", () => setSelectedTextBlock(div));

    const rotateHandle = document.createElement("div");
    rotateHandle.className = "rotate-handle";
    rotateHandle.innerHTML = "\u21BB";
    Object.assign(rotateHandle.style, rotateHandleStyle);
    div.appendChild(rotateHandle);

    canvasRef.current.appendChild(div);
    makeDraggable(div, null, rotateHandle);
  };

  const applyTextStyle = (style, value) => {
    if (!selectedTextBlock) return;
    selectedTextBlock.focus();
    switch (style) {
      case "bold":
        document.execCommand("bold", false, null);
        break;
      case "italic":
        document.execCommand("italic", false, null);
        break;
      case "underline":
        document.execCommand("underline", false, null);
        break;
      case "fontSize":
        document.execCommand("fontSize", false, "7");
        const fontElements = selectedTextBlock.getElementsByTagName("font");
        for (let i = 0; i < fontElements.length; i++) {
          if (fontElements[i].size === "7") {
            fontElements[i].removeAttribute("size");
            fontElements[i].style.fontSize = value;
          }
        }
        break;
      case "color":
      case "foreColor":
        document.execCommand("foreColor", false, value);
        break;
      default:
        break;
    }
  };

  const applyTextAlignment = (alignment) => {
    if (selectedTextBlock && selectedTextBlock.contentEditable === "true") {
      selectedTextBlock.style.textAlign = alignment;
    }
  };

  function makeDraggable(wrapper, img = null, rotateHandle = null) {
    interact(wrapper)
      .draggable({
        ignoreFrom: '.rotate-handle',
        listeners: {
          move(event) {
            const x = (parseFloat(wrapper.getAttribute("data-x")) || 0) + event.dx;
            const y = (parseFloat(wrapper.getAttribute("data-y")) || 0) + event.dy;
            const angle = wrapper.getAttribute("data-rotate") || 0;
            wrapper.style.transform = `translate(${x}px, ${y}px) rotate(${angle}deg)`;
            wrapper.setAttribute("data-x", x);
            wrapper.setAttribute("data-y", y);
          },
        },
      })
      .resizable({
        edges: { left: true, right: true, bottom: true, top: true },
        listeners: {
          move(event) {
            const { width, height } = event.rect;
            if (img) {
              img.style.width = `${width}px`;
              img.style.height = `${height}px`;
            } else {
              wrapper.style.width = `${width}px`;
              wrapper.style.height = `${height}px`;
            }
            const x = (parseFloat(wrapper.getAttribute("data-x")) || 0) + event.deltaRect.left;
            const y = (parseFloat(wrapper.getAttribute("data-y")) || 0) + event.deltaRect.top;
            wrapper.style.transform = `translate(${x}px, ${y}px) rotate(${wrapper.getAttribute("data-rotate") || 0}deg)`;
            wrapper.setAttribute("data-x", x);
            wrapper.setAttribute("data-y", y);
          },
        },
      });

    if (rotateHandle) {
      interact(rotateHandle).draggable({
        listeners: {
          move(event) {
            const rect = wrapper.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const angle = Math.atan2(event.clientY - centerY, event.clientX - centerX) * (180 / Math.PI);
            const x = wrapper.getAttribute("data-x") || 0;
            const y = wrapper.getAttribute("data-y") || 0;
            wrapper.style.transform = `translate(${x}px, ${y}px) rotate(${angle}deg)`;
            wrapper.setAttribute("data-rotate", angle);
          },
        },
      });
    }
  }

  const handleSave = async (asPDF = false) => {
    setSaveMessage(asPDF ? "Saving as PDF..." : "Saving your story...");

    await anime({
      targets: "#saveMessage",
      opacity: [0, 1],
      scale: [0.9, 1],
      duration: 800,
      easing: "easeOutExpo",
    }).finished;

    await anime({
      targets: "#progressBar",
      width: ["0%", "100%"],
      duration: 2000,
      easing: "easeInOutQuad",
    }).finished;

    const saveUI = document.getElementById("saveAnimationContainer");
    const toolbar = document.getElementById("toolbar");
    const floatingToolbar = document.querySelector(".floating-toolbar");

    saveUI.style.visibility = "hidden";
    toolbar.style.visibility = "hidden";
    if (floatingToolbar) floatingToolbar.style.visibility = "hidden";

    await new Promise((resolve) => setTimeout(resolve, 500));

    const capturedCanvas = await html2canvas(canvasRef.current, {
      ignoreElements: (element) =>
        element.id === "saveAnimationContainer" ||
        element.id === "toolbar" ||
        element.classList.contains("rotate-handle") ||
        element.classList.contains("floating-toolbar"),
    });

    const image = capturedCanvas.toDataURL("image/png");

    if (asPDF) {
      const pdf = new jsPDF({ orientation: 'landscape' });
      const imgProps = pdf.getImageProperties(image);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(image, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save("canvas_snapshot.pdf");
      setSaveMessage("PDF saved successfully!");
    } else {
      const link = document.createElement("a");
      link.href = image;
      link.download = "canvas_snapshot.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setSaveMessage("Journal saved successfully!");
    }

    saveUI.style.visibility = "visible";
    toolbar.style.visibility = "visible";
    if (floatingToolbar) floatingToolbar.style.visibility = "visible";
  };

  useEffect(() => {
    if (saveMessage && saveMessageRef.current) {
      anime({
        targets: "#saveMessage",
        opacity: [0, 1],
        scale: [0.9, 1],
        duration: 800,
        easing: "easeOutExpo",
      });

      anime({
        targets: "#progressBar",
        width: ["0%", "100%"],
        duration: 2000,
        easing: "easeInOutQuad",
      });
    }
  }, [saveMessage]);

  return (
    <div className="Wrapper" ref={canvasRef}>
      <div id="toolbar" style={toolbarStyle}>
        <input type="file" accept="image/*" onChange={handleImageUpload} />
        <button onClick={addTextBlock}>Add Text</button>
        <button onClick={() => handleSave(false)}>Save</button>
        <button onClick={() => handleSave(true)}>Save as PDF</button>
      </div>

      <div id="canvasArea" style={canvasStyle} onDragOver={handleDragOver} onDrop={handleDrop}>
        <div id="saveAnimationContainer" style={saveAnimationStyle}>
          {saveMessage && (
            <div id="saveMessage" ref={saveMessageRef} style={{ fontSize: "18px", opacity: 0 }}>{saveMessage}</div>
          )}
          <div id="progressBar" style={{ height: "4px", background: "#28a745", width: 0 }}></div>
        </div>
      </div>

      {selectedTextBlock && (
        <div className="floating-toolbar" style={floatingToolbarStyle}>
          <button onClick={() => applyTextStyle("bold")}><b>B</b></button>
          <button onClick={() => applyTextStyle("italic")}><i>I</i></button>
          <button onClick={() => applyTextStyle("underline")}><u>U</u></button>
          <button onClick={() => applyTextAlignment("left")}>Left</button>
          <button onClick={() => applyTextAlignment("center")}>Center</button>
          <button onClick={() => applyTextAlignment("right")}>Right</button>
          <select onChange={(e) => applyTextStyle("fontSize", e.target.value)}>
            <option value="16px">16px</option>
            <option value="24px">24px</option>
            <option value="32px">32px</option>
            <option value="48px">48px</option>
            <option value="60px">60px</option>
            <option value="72px">72px</option>
            <option value="100px">100px</option>
          </select>
          <input type="color" onChange={(e) => applyTextStyle("color", e.target.value)} title="Text Color" />
        </div>
      )}
    </div>
  );
}

const canvasStyle = {
  marginTop: "7vh",
  position: "relative",
  width: "100vw",
  height: "100vh",
  backgroundColor: "white",
  overflow: "hidden",
};

const toolbarStyle = {
  position: "absolute",
  top: "10px",
  left: "1%",
  background: "whitesmoke",
  padding: "10px",
  border: "1px solid #ccc",
  borderRadius: "5px",
  zIndex: 999,
};

const textBlockStyle = {
  position: "absolute",
  top: "10%",
  left: "1%",
  minWidth: "20vw",
  minHeight: "10vh",
  maxWidth: "80vw",
  maxHeight: "50vh",
  padding: "5px",
  color: "#333",
  fontFamily: "Arial, sans-serif",
  fontSize: "16px",
  backgroundColor: "white",
  cursor: "move",
};

const rotateHandleStyle = {
  position: "absolute",
  top: "-25px",
  left: "50%",
  transform: "translateX(-50%)",
  cursor: "grab",
  userSelect: "none",
};

const floatingToolbarStyle = {
  position: "absolute",
  left: "28%",
  top: "10px",
  background: "whitesmoke",
  padding: "7px",
  paddingTop: "4px",
  paddingBottom: "10px",
  border: "1px solid #ccc",
  borderRadius: "5px",
  zIndex: 999,
};

const saveAnimationStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  position: "absolute",
  left: "40%",
  bottom: "10%",
  background: "white",
  padding: "10px",
  borderRadius: "8px",
  boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
  zIndex: 1000,
  width: "20vw",
  height: '4vh',
};
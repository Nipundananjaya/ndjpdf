// Wait for the jsPDF library to be loaded
window.onload = function() {
    // Initialize variables
    const { jsPDF } = window.jspdf;
    let uploadedFiles = [];
    let photosPerPage = 4;
    let generatedPdfData = null; // Variable to store the generated PDF data
    
    // DOM elements
    const fileInput = document.getElementById('file-input');
    const uploadArea = document.getElementById('upload-area');
    const previewGrid = document.getElementById('preview-grid');
    const emptyState = document.getElementById('empty-state');
    const clearAllBtn = document.getElementById('clear-all');
    const generateBtn = document.getElementById('generate-btn');
    const downloadBtn = document.getElementById('download-btn');
    const photosPerPageInput = document.getElementById('photos-per-page');
    const photosPerPageValue = document.getElementById('photos-per-page-value');
    const statusMessage = document.getElementById('status-message');
    const loader = document.getElementById('loader');
    
    // Update photos per page value
    photosPerPageInput.addEventListener('input', function() {
        photosPerPage = parseInt(this.value);
        photosPerPageValue.textContent = photosPerPage;
    });
    
    // Handle file upload via click
    uploadArea.addEventListener('click', function() {
        fileInput.click();
    });
    
    // Handle drag and drop events
    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadArea.classList.add('active');
    });
    
    uploadArea.addEventListener('dragleave', function() {
        uploadArea.classList.remove('active');
    });
    
    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('active');
        handleFiles(e.dataTransfer.files);
    });
    
    // Handle file selection
    fileInput.addEventListener('change', function() {
        handleFiles(this.files);
    });
    
    // Clear all uploaded photos
    clearAllBtn.addEventListener('click', function() {
        uploadedFiles = [];
        updatePreview();
        // Hide download button if visible
        downloadBtn.style.display = 'none';
        generatedPdfData = null;
    });
    
    // Generate PDF button
    generateBtn.addEventListener('click', function() {
        generatePDF();
    });
    
    // Download PDF button
    downloadBtn.addEventListener('click', function() {
        if (generatedPdfData) {
            try {
                // Create a download link for the PDF
                const blob = generatedPdfData.output('blob');
                const url = URL.createObjectURL(blob);
                
                // Create a temporary link and click it
                const downloadLink = document.createElement('a');
                downloadLink.href = url;
                downloadLink.download = 'photos.pdf';
                downloadLink.click();
                
                // Clean up
                URL.revokeObjectURL(url);
                
                showStatus('PDF downloaded successfully!', 'success');
            } catch (error) {
                console.error('Download error:', error);
                showStatus('Error downloading PDF. Please try again.', 'error');
            }
        }
    });
    
    // Handle uploaded files
    function handleFiles(files) {
        if (files.length === 0) return;
        
        statusMessage.classList.add('hidden');
        
        // Hide download button when new files are uploaded
        downloadBtn.style.display = 'none';
        generatedPdfData = null;
        
        // Filter only image files
        const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
        
        if (imageFiles.length === 0) {
            showStatus('Please upload image files only.', 'error');
            return;
        }
        
        // Process each image file
        let loadedCount = 0;
        const totalFiles = imageFiles.length;
        
        imageFiles.forEach(file => {
            // Check file size - limit to 10MB to prevent memory issues
            if (file.size > 10 * 1024 * 1024) {
                showStatus(`File ${file.name} exceeds 10MB limit and was skipped.`, 'error');
                loadedCount++;
                
                if (loadedCount === totalFiles) {
                    updatePreview();
                }
                return;
            }
            
            const reader = new FileReader();
            
            reader.onload = function(e) {
                const img = new Image();
                img.src = e.target.result;
                
                img.onload = function() {
                    uploadedFiles.push({
                        src: e.target.result,
                        name: file.name,
                        width: img.width,
                        height: img.height,
                        aspectRatio: img.width / img.height
                    });
                    
                    loadedCount++;
                    if (loadedCount === totalFiles) {
                        updatePreview();
                    }
                };
                
                img.onerror = function() {
                    console.error(`Failed to load image: ${file.name}`);
                    loadedCount++;
                    if (loadedCount === totalFiles) {
                        updatePreview();
                    }
                };
            };
            
            reader.onerror = function() {
                console.error(`Failed to read file: ${file.name}`);
                loadedCount++;
                if (loadedCount === totalFiles) {
                    updatePreview();
                }
            };
            
            reader.readAsDataURL(file);
        });
    }
    
    // Update preview grid
    function updatePreview() {
        if (uploadedFiles.length === 0) {
            emptyState.style.display = 'block';
            previewGrid.style.display = 'none';
            clearAllBtn.style.display = 'none';
            generateBtn.disabled = true;
        } else {
            emptyState.style.display = 'none';
            previewGrid.style.display = 'grid';
            clearAllBtn.style.display = 'inline-block';
            generateBtn.disabled = false;
        }
        
        // Clear preview grid
        previewGrid.innerHTML = '';
        
        // Add each image to the preview
        uploadedFiles.forEach((file, index) => {
            const previewItem = document.createElement('div');
            previewItem.className = 'preview-item';
            
            const img = document.createElement('img');
            img.src = file.src;
            img.alt = file.name;
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.innerHTML = '×';
            removeBtn.addEventListener('click', function(e) {
                e.stopPropagation(); // Prevent bubbling to parent
                uploadedFiles.splice(index, 1);
                updatePreview();
                // Hide download button if visible
                downloadBtn.style.display = 'none';
                generatedPdfData = null;
            });
            
            previewItem.appendChild(img);
            previewItem.appendChild(removeBtn);
            previewGrid.appendChild(previewItem);
        });
    }
    
    // Generate PDF
    function generatePDF() {
        if (uploadedFiles.length === 0) return;
        
        // Show loader and hide status
        loader.classList.remove('hidden');
        statusMessage.classList.add('hidden');
        
        // Use setTimeout to allow UI to update before heavy processing
        setTimeout(() => {
            try {
                // Create PDF document (A4 size)
                const pdf = new jsPDF({
                    orientation: 'portrait',
                    unit: 'mm',
                    format: 'a4'
                });
                
                // A4 dimensions in mm
                const pageWidth = 210;
                const pageHeight = 297;
                const margin = 10;
                const availableWidth = pageWidth - (2 * margin);
                const availableHeight = pageHeight - (2 * margin);
                
                // Process images in batches for each page
                const totalPages = Math.ceil(uploadedFiles.length / photosPerPage);
                
                for (let page = 0; page < totalPages; page++) {
                    if (page > 0) {
                        pdf.addPage();
                    }
                    
                    // Get images for this page
                    const pageImages = uploadedFiles.slice(
                        page * photosPerPage, 
                        Math.min((page + 1) * photosPerPage, uploadedFiles.length)
                    );
                    
                    try {
                        // Try using the optimized layout engine first
                        const layout = optimizeImageLayout(pageImages, availableWidth, availableHeight, margin);
                        
                        // Add each image to the PDF according to the layout
                        for (const item of layout) {
                            try {
                                const { src, x, y, width, height, rotation } = item;
                                
                                if (rotation) {
                                    // Save state, translate to position, rotate, then draw
                                    pdf.saveGraphicsState();
                                    
                                    // Move to center of where image should be
                                    const centerX = x + width/2;
                                    const centerY = y + height/2;
                                    
                                    // Translate to center point, rotate, then translate back
                                    pdf.translate(centerX, centerY);
                                    pdf.rotate(rotation * Math.PI / 180);
                                    
                                    // Draw image (adjusting position to account for rotation)
                                    pdf.addImage(src, 'JPEG', -width/2, -height/2, width, height);
                                    
                                    // Restore graphics state
                                    pdf.restoreGraphicsState();
                                } else {
                                    // Add image normally if no rotation
                                    pdf.addImage(src, 'JPEG', x, y, width, height);
                                }
                            } catch (imageError) {
                                console.error('Error adding image to PDF:', imageError);
                                // Continue with next image if one fails
                                continue;
                            }
                        }
                    } catch (layoutError) {
                        console.error('Optimized layout failed, using fallback grid layout:', layoutError);
                        
                        // Fallback to simple grid layout if the optimized layout fails
                        addImagesInGridLayout(pdf, pageImages, margin, availableWidth, availableHeight);
                    }
                }
                
                // Store the generated PDF
                generatedPdfData = pdf;
                
                // Show download button
                downloadBtn.style.display = 'inline-block';
                
                // Hide loader and show success message
                loader.classList.add('hidden');
                showStatus('PDF generated successfully! Click the download button to save it.', 'success');
            } catch (error) {
                // Hide loader and show error message
                loader.classList.add('hidden');
                showStatus('Error generating PDF. Please try again.', 'error');
                console.error('PDF generation error:', error);
                
                // Try again with basic layout if advanced layout failed
                tryFallbackPdfGeneration();
            }
        }, 100); // Small delay to allow the loader to appear
    }
    
    // Fallback PDF generation with simpler layout
    function tryFallbackPdfGeneration() {
        if (uploadedFiles.length === 0) return;
        
        try {
            console.log("Attempting fallback PDF generation with basic layout");
            
            // Create PDF document (A4 size)
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });
            
            // A4 dimensions in mm
            const pageWidth = 210;
            const pageHeight = 297;
            const margin = 10;
            const availableWidth = pageWidth - (2 * margin);
            const availableHeight = pageHeight - (2 * margin);
            
            // Calculate number of pages needed
            const totalPages = Math.ceil(uploadedFiles.length / photosPerPage);
            
            // Process each page
            for (let page = 0; page < totalPages; page++) {
                if (page > 0) {
                    pdf.addPage();
                }
                
                // Get images for this page
                const pageImages = uploadedFiles.slice(
                    page * photosPerPage, 
                    Math.min((page + 1) * photosPerPage, uploadedFiles.length)
                );
                
                // Use simplest possible layout - grid
                addImagesInGridLayout(pdf, pageImages, margin, availableWidth, availableHeight);
            }
            
            // Store the generated PDF
            generatedPdfData = pdf;
            
            // Show download button
            downloadBtn.style.display = 'inline-block';
            
            // Show success message
            showStatus('PDF generated with basic layout. Click download to save.', 'success');
        } catch (error) {
            console.error('Fallback PDF generation failed:', error);
            showStatus('PDF generation failed. Try reducing image size or count.', 'error');
        }
    }
    
    // Simple grid layout function (fallback)
    function addImagesInGridLayout(pdf, images, margin, availableWidth, availableHeight) {
        const count = images.length;
        let cols = 1, rows = 1;
        
        // Determine grid dimensions based on photo count
        if (count <= 1) {
            cols = 1; rows = 1;
        } else if (count <= 2) {
            cols = 2; rows = 1;
        } else if (count <= 4) {
            cols = 2; rows = 2;
        } else if (count <= 6) {
            cols = 2; rows = 3;
        } else if (count <= 9) {
            cols = 3; rows = 3;
        } else {
            cols = 3; rows = 4;
        }
        
        // Calculate cell dimensions
        const cellWidth = availableWidth / cols;
        const cellHeight = availableHeight / rows;
        const padding = 3; // Smaller padding for more space
        
        // Add each image to the grid
        images.forEach((img, index) => {
            if (index >= cols * rows) return; // Skip if beyond grid capacity
            
            // Calculate position
            const row = Math.floor(index / cols);
            const col = index % cols;
            
            // Calculate position on the page
            const x = margin + (col * cellWidth) + padding;
            const y = margin + (row * cellHeight) + padding;
            const w = cellWidth - (padding * 2);
            const h = cellHeight - (padding * 2);
            
            try {
                // Maintain aspect ratio
                let imgWidth, imgHeight;
                const aspectRatio = img.width / img.height;
                
                if (aspectRatio > w / h) {
                    // Image is wider than the cell
                    imgWidth = w;
                    imgHeight = w / aspectRatio;
                } else {
                    // Image is taller than the cell
                    imgHeight = h;
                    imgWidth = h * aspectRatio;
                }
                
                // Center the image in the cell
                const xOffset = x + (w - imgWidth) / 2;
                const yOffset = y + (h - imgHeight) / 2;
                
                // Add image to PDF
                pdf.addImage(img.src, 'JPEG', xOffset, yOffset, imgWidth, imgHeight);
            } catch (error) {
                console.error(`Failed to add image ${index} to PDF:`, error);
            }
        });
    }
    
    // Function to optimize image layout to fill space efficiently
    function optimizeImageLayout(images, availableWidth, availableHeight, margin) {
        // Safety check
        if (!images || images.length === 0) {
            throw new Error("No images to layout");
        }
        
        const layout = [];
        
        // Clone images to avoid modifying originals
        const imagesToPlace = images.map(img => ({...img}));
        
        // For different numbers of images, use different layout strategies
        if (imagesToPlace.length === 1) {
            // Single image - fill the page with margins
            const img = imagesToPlace[0];
            
            // Calculate dimensions maintaining aspect ratio
            let width, height;
            if (img.aspectRatio > availableWidth / availableHeight) {
                // Image is wider than the available space
                width = availableWidth;
                height = width / img.aspectRatio;
            } else {
                // Image is taller than the available space
                height = availableHeight;
                width = height * img.aspectRatio;
            }
            
            // Center the image on the page
            const x = margin + (availableWidth - width) / 2;
            const y = margin + (availableHeight - height) / 2;
            
            layout.push({
                src: img.src,
                x: x,
                y: y,
                width: width,
                height: height,
                rotation: 0
            });
        } else if (imagesToPlace.length === 2) {
            // Sort by aspect ratio
            imagesToPlace.sort((a, b) => b.aspectRatio - a.aspectRatio);
            
            const img1 = imagesToPlace[0];
            const img2 = imagesToPlace[1];
            
            // Determine whether to split horizontally or vertically
            const horizontalSplit = img1.aspectRatio > 1.2 && img2.aspectRatio > 1.2;
            const verticalSplit = img1.aspectRatio < 0.8 && img2.aspectRatio < 0.8;
            
            if (verticalSplit) {
                // Side by side for portrait images
                const halfWidth = availableWidth / 2;
                const gap = 5;
                
                // First image
                layout.push({
                    src: img1.src,
                    x: margin,
                    y: margin,
                    width: halfWidth - gap/2,
                    height: availableHeight,
                    rotation: 0
                });
                
                // Second image
                layout.push({
                    src: img2.src,
                    x: margin + halfWidth + gap/2,
                    y: margin,
                    width: halfWidth - gap/2,
                    height: availableHeight,
                    rotation: 0
                });
            } else if (horizontalSplit) {
                // Stacked for landscape images
                const halfHeight = availableHeight / 2;
                const gap = 5;
                
                // First image
                layout.push({
                    src: img1.src,
                    x: margin,
                    y: margin,
                    width: availableWidth,
                    height: halfHeight - gap/2,
                    rotation: 0
                });
                
                // Second image
                layout.push({
                    src: img2.src,
                    x: margin,
                    y: margin + halfHeight + gap/2,
                    width: availableWidth,
                    height: halfHeight - gap/2,
                    rotation: 0
                });
            } else {
                // Mixed orientation or square images - use dynamic division
                
                // Calculate total area and distribute proportionally
                const totalAspectRatio = img1.aspectRatio + img2.aspectRatio;
                const img1WidthRatio = img1.aspectRatio / totalAspectRatio;
                
                // Decide whether to split horizontally or vertically
                if (availableWidth > availableHeight) {
                    // Split horizontally
                    const splitPoint = availableWidth * img1WidthRatio;
                    const gap = 5;
                    
                    // First image
                    layout.push({
                        src: img1.src,
                        x: margin,
                        y: margin,
                        width: splitPoint - gap/2,
                        height: availableHeight,
                        rotation: 0
                    });
                    
                    // Second image
                    layout.push({
                        src: img2.src,
                        x: margin + splitPoint + gap/2,
                        y: margin,
                        width: availableWidth - splitPoint - gap/2,
                        height: availableHeight,
                        rotation: 0
                    });
                } else {
                    // Split vertically
                    const splitPoint = availableHeight * img1WidthRatio;
                    const gap = 5;
                    
                    // First image
                    layout.push({
                        src: img1.src,
                        x: margin,
                        y: margin,
                        width: availableWidth,
                        height: splitPoint - gap/2,
                        rotation: 0
                    });
                    
                    // Second image
                    layout.push({
                        src: img2.src,
                        x: margin,
                        y: margin + splitPoint + gap/2,
                        width: availableWidth,
                        height: availableHeight - splitPoint - gap/2,
                        rotation: 0
                    });
                }
            }
        } else if (imagesToPlace.length <= 4) {
            // For 3-4 images, use a simple grid layout
            const cols = 2;
            const rows = Math.ceil(imagesToPlace.length / cols);
            const cellWidth = availableWidth / cols;
            const cellHeight = availableHeight / rows;
            const padding = 3;
            
            // Sort images by aspect ratio for better placement
            imagesToPlace.sort((a, b) => {
                // Group landscape and portrait images
                const aIsLandscape = a.aspectRatio >= 1;
                const bIsLandscape = b.aspectRatio >= 1;
                if (aIsLandscape !== bIsLandscape) return aIsLandscape ? -1 : 1;
                // Then sort by aspect ratio
                return b.aspectRatio - a.aspectRatio;
            });
            
            // Place images in grid
            imagesToPlace.forEach((img, index) => {
                // Calculate position
                const row = Math.floor(index / cols);
                const col = index % cols;
                
                // Calculate cell dimensions and position
                const x = margin + (col * cellWidth) + padding;
                const y = margin + (row * cellHeight) + padding;
                const w = cellWidth - (padding * 2);
                const h = cellHeight - (padding * 2);
                
                // Calculate image dimensions maintaining aspect ratio
                let imgWidth, imgHeight;
                if (img.aspectRatio > w / h) {
                    // Image is wider than the cell
                    imgWidth = w;
                    imgHeight = w / img.aspectRatio;
                } else {
                    // Image is taller than the cell
                    imgHeight = h;
                    imgWidth = h * img.aspectRatio;
                }
                
                // Center the image in the cell
                const xOffset = x + (w - imgWidth) / 2;
                const yOffset = y + (h - imgHeight) / 2;
                
                layout.push({
                    src: img.src,
                    x: xOffset,
                    y: yOffset,
                    width: imgWidth,
                    height: imgHeight,
                    rotation: 0
                });
            });
        } else {
            // For 5+ images, use a dynamic collage layout
            const grid = createCollageLayout(imagesToPlace, availableWidth, availableHeight, margin);
            return grid;
        }
        
        return layout;
    }
    
    // Create collage layout for 5+ images
    function createCollageLayout(images, availableWidth, availableHeight, margin) {
        const layout = [];
        const gap = 4; // Gap between images
        
        // Sort images by aspect ratio
        const sortedImages = [...images].sort((a, b) => b.aspectRatio - a.aspectRatio);
        
        // Determine grid dimensions based on count
        let cols, rows;
        const count = images.length;
        
        if (count <= 6) {
            cols = 2;
            rows = Math.ceil(count / cols);
        } else if (count <= 9) {
            cols = 3;
            rows = Math.ceil(count / cols);
        } else {
            cols = 3;
            rows = Math.ceil(count / cols);
        }
        
        // Create a grid of cells
        const cellWidth = availableWidth / cols;
        const cellHeight = availableHeight / rows;
        
        // Assign images to cells with special cases for certain numbers
        if (count === 5) {
            // Special case for 5 images: 2x2 grid with the 5th image taking two slots
            
            // First 4 images in a 2x2 grid
            for (let i = 0; i < 4; i++) {
                const row = Math.floor(i / 2);
                const col = i % 2;
                const img = sortedImages[i];
                
                const x = margin + col * cellWidth + gap/2;
                const y = margin + row * cellHeight + gap/2;
                const width = cellWidth - gap;
                const height = cellHeight - gap;
                
                layout.push({
                    src: img.src,
                    x: x,
                    y: y,
                    width: width,
                    height: height,
                    rotation: 0
                });
            }
            
            // 5th image takes the bottom row spanning full width
            const lastImg = sortedImages[4];
            layout.push({
                src: lastImg.src,
                x: margin + gap/2,
                y: margin + 2 * cellHeight + gap/2,
                width: availableWidth - gap,
                height: cellHeight - gap,
                rotation: 0
            });
        } else {
            // Default grid layout for other numbers
            sortedImages.forEach((img, index) => {
                if (index >= cols * rows) return; // Skip if beyond grid capacity
                
                const row = Math.floor(index / cols);
                const col = index % cols;
                
                const x = margin + col * cellWidth + gap/2;
                const y = margin + row * cellHeight + gap/2;
                const width = cellWidth - gap;
                const height = cellHeight - gap;
                
                layout.push({
                    src: img.src,
                    x: x,
                    y: y,
                    width: width,
                    height: height,
                    rotation: 0
                });
            });
        }
        
        return layout;
    }
    
    // Show status message
    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type}`;
        statusMessage.classList.remove('hidden');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            statusMessage.classList.add('hidden');
        }, 5000);
    }
};
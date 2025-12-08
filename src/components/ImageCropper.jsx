import { useState, useRef, useCallback, useEffect } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
} from '@mui/material';

// Helper to center the crop initially
function centerAspectCrop(mediaWidth, mediaHeight, aspect) {
    return centerCrop(
        makeAspectCrop(
            {
                unit: '%',
                width: 90,
            },
            aspect,
            mediaWidth,
            mediaHeight,
        ),
        mediaWidth,
        mediaHeight,
    );
}

const ImageCropper = ({ open, image, onComplete, onCancel, aspectRatio = 1 }) => {
    const [crop, setCrop] = useState();
    const [completedCrop, setCompletedCrop] = useState(null);
    const imgRef = useRef(null);

    const onImageLoad = (e) => {
        const { width, height } = e.currentTarget;
        const crop = centerAspectCrop(width, height, aspectRatio);
        setCrop(crop);
        setCompletedCrop(crop);
    };

    const getCroppedImg = useCallback(async (image, crop) => {
        const canvas = document.createElement('canvas');
        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;
        canvas.width = crop.width * scaleX;
        canvas.height = crop.height * scaleY;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            return null;
        }

        ctx.drawImage(
            image,
            crop.x * scaleX,
            crop.y * scaleY,
            crop.width * scaleX,
            crop.height * scaleY,
            0,
            0,
            crop.width * scaleX,
            crop.height * scaleY,
        );

        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/jpeg');
        });
    }, []);

    const handleSave = async () => {
        if (completedCrop && imgRef.current) {
            try {
                // Check if crop has width/height to avoid error on empty crop
                if (completedCrop.width && completedCrop.height) {
                    const croppedBlob = await getCroppedImg(imgRef.current, completedCrop);
                    onComplete(croppedBlob);
                } else {
                    // If no crop, maybe return original? Or just nothing.
                    // Usually user sees a box. If they minimized it to 0, return nothing or treat as cancel?
                    // For now, let's assume they want the whole image if they didn't crop? 
                    // actually react-image-crop always allows a crop.
                    onComplete(null);
                }
            } catch (e) {
                console.error(e);
                onComplete(null);
            }
        } else {
            onComplete(null);
        }
    };

    return (
        <Dialog open={open} onClose={onCancel} maxWidth="md">
            <DialogTitle>Adjust Image</DialogTitle>
            <DialogContent>
                <Box sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    bgcolor: '#333',
                    p: 2,
                    minWidth: 300,
                    overflow: 'auto'
                }}>
                    {image && (
                        <ReactCrop
                            crop={crop}
                            onChange={(_, percentCrop) => setCrop(percentCrop)}
                            onComplete={(c) => setCompletedCrop(c)}
                            aspect={aspectRatio}
                        >
                            <img
                                ref={imgRef}
                                alt="Crop me"
                                src={image}
                                onLoad={onImageLoad}
                                style={{ maxWidth: '100%', maxHeight: '60vh' }}
                            />
                        </ReactCrop>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onCancel}>Cancel</Button>
                <Button onClick={handleSave} variant="contained" color="primary">
                    Save
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ImageCropper;

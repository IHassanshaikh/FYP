import os
import json
import numpy as np
from PIL import Image
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, accuracy_score
import time

def extract_features(img_path, target_size=(32, 32)):
    """
    Extracts normalized multi-channel color & spatial projection features.
    Downscales to target_size (32x32) in RGB (3072 features), plus row/col intensity distributions.
    """
    try:
        with Image.open(img_path) as img:
            rgb_img = img.convert('RGB').resize(target_size, Image.Resampling.BILINEAR)
            arr = np.array(rgb_img, dtype=np.float32) / 255.0
            
            # 1. Flattened raw color patches
            flat_color = arr.flatten()
            
            # 2. Grayscale spatial projections (horizontal and vertical profiles)
            gray = 0.2989 * arr[:, :, 0] + 0.5870 * arr[:, :, 1] + 0.1140 * arr[:, :, 2]
            row_profile = gray.mean(axis=1) # 32 values
            col_profile = gray.mean(axis=0) # 32 values
            
            # Combine
            features = np.concatenate([flat_color, row_profile, col_profile])
            return features
    except Exception as e:
        return None

def main():
    print("=== Training Cricket Shot Vision Classifier ===")
    start_time = time.time()
    
    data_dir = r"d:\vector bat mobile app\data\images"
    classes = ["drive", "legglance-flick", "pullshot", "sweep"]
    
    X = []
    y = []
    
    print("Loading image dataset...")
    for idx, cls_name in enumerate(classes):
        cls_dir = os.path.join(data_dir, cls_name)
        files = [f for f in os.listdir(cls_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')) and not f.startswith('.')]
        print(f"  Class '{cls_name}': {len(files)} candidate images")
        
        # Balance & load samples
        loaded_count = 0
        for f in files:
            feat = extract_features(os.path.join(cls_dir, f))
            if feat is not None:
                X.append(feat)
                y.append(idx)
                loaded_count += 1
                
        print(f"    Loaded {loaded_count} features successfully.")

    X = np.array(X, dtype=np.float32)
    y = np.array(y, dtype=np.int32)
    print(f"\nTotal Dataset Matrix: {X.shape[0]} samples, {X.shape[1]} features per sample.")

    # Train / Test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    print(f"Train samples: {len(X_train)}, Test samples: {len(X_test)}")

    print("\nFitting Logistic Regression (Softmax) model with L2 regularization...")
    clf = LogisticRegression(max_iter=300, solver='lbfgs', C=1.0, random_state=42)
    clf.fit(X_train, y_train)

    # Evaluation
    y_pred = clf.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"\n>>> Test Accuracy: {acc * 100:.2f}% <<<")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=classes))

    # Export model weights and biases for on-device mobile JS/TS inference
    # W is shape (n_classes, n_features), b is shape (n_classes,)
    weights = clf.coef_.tolist()
    intercepts = clf.intercept_.tolist()

    # Also calculate mean shot class feature representations (centroids)
    centroids = {}
    for idx, cls_name in enumerate(classes):
        cls_samples = X[y == idx]
        centroids[cls_name] = cls_samples.mean(axis=0).tolist()

    model_artifact = {
        "modelType": "SoftmaxClassifier",
        "classes": classes,
        "inputShape": [32, 32, 3],
        "featureDim": int(X.shape[1]),
        "accuracy": float(acc),
        "weights": weights,
        "intercepts": intercepts,
        "classLabels": {
            "drive": "Cover / Straight Drive",
            "legglance-flick": "Leg Glance / Flick",
            "pullshot": "Pull / Hook Shot",
            "sweep": "Sweep / Reverse Sweep"
        },
        "shotBiomechanicsMap": {
            "drive": {"typicalSpeedRange": [75, 95], "typicalLiftAngle": [45, 60], "zone": "Off Side / Cover / Long-Off"},
            "legglance-flick": {"typicalSpeedRange": [65, 85], "typicalLiftAngle": [35, 55], "zone": "Mid-Wicket / Square Leg"},
            "pullshot": {"typicalSpeedRange": [85, 110], "typicalLiftAngle": [65, 85], "zone": "Deep Mid-Wicket / Square Leg"},
            "sweep": {"typicalSpeedRange": [60, 80], "typicalLiftAngle": [30, 48], "zone": "Fine Leg / Backward Square"}
        },
        "trainedTimestamp": time.strftime("%Y-%m-%d %H:%M:%S")
    }

    output_path = r"d:\vector bat mobile app\services\trained_shot_model.json"
    with open(output_path, "w") as out_f:
        json.dump(model_artifact, out_f)
    print(f"\nModel exported successfully to: {output_path} (Size: {os.path.getsize(output_path) / 1024:.1f} KB)")
    print(f"Total time elapsed: {time.time() - start_time:.2f} seconds.")

if __name__ == "__main__":
    main()

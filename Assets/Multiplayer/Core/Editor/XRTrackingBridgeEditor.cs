using UnityEditor;
using UnityEngine;

[CustomEditor(typeof(XRTrackingBridge))]
public class XRTrackingBridgeEditor : Editor
{
    private SerializedProperty xrOriginProp;
    private SerializedProperty headSourceProp;
    private SerializedProperty leftHandSourceProp;
    private SerializedProperty rightHandSourceProp;

    private void OnEnable()
    {
        xrOriginProp = serializedObject.FindProperty("xrOrigin");
        headSourceProp = serializedObject.FindProperty("headSource");
        leftHandSourceProp = serializedObject.FindProperty("leftHandSource");
        rightHandSourceProp = serializedObject.FindProperty("rightHandSource");
    }

    public override void OnInspectorGUI()
    {
        DrawDefaultInspector();

        XRTrackingBridge bridge = (XRTrackingBridge)target;

        EditorGUILayout.Space();

        bool hasOrigin = bridge.TryGetOrigin(out _);
        bool hasMissing = xrOriginProp.objectReferenceValue == null ||
                          headSourceProp.objectReferenceValue == null ||
                          leftHandSourceProp.objectReferenceValue == null ||
                          rightHandSourceProp.objectReferenceValue == null;

        using (new EditorGUI.DisabledScope(!hasOrigin && !Application.isPlaying))
        {
            if (GUILayout.Button("Auto-Wire From Scene", GUILayout.Height(30)))
            {
                Undo.RecordObject(bridge, "Auto-Wire XRTrackingBridge");
                bridge.AutoWire();
                serializedObject.Update();
                EditorUtility.SetDirty(bridge);
                if (!Application.isPlaying)
                    UnityEditor.SceneManagement.EditorSceneManager.MarkSceneDirty(
                        UnityEngine.SceneManagement.SceneManager.GetActiveScene());
            }
        }

        if (hasMissing && !Application.isPlaying)
        {
            EditorGUILayout.HelpBox(
                hasOrigin
                    ? "References are missing. Click 'Auto-Wire From Scene' to populate them."
                    : "No XR Origin found in the scene. Add an XR Interaction Setup first, then click 'Auto-Wire From Scene'.",
                MessageType.Warning);
        }
        else if (!hasMissing)
        {
            EditorGUILayout.HelpBox("All references are wired.", MessageType.Info);
        }
    }
}
